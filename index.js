require('dotenv').config();
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const validator = require('email-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { sendEmail } = require('./email.js');
//const { verifyJWT } = require('./verifyJWT');
const { generateUniqueUserId } = require('./helpers/generateId');

const { hrtime } = require('process');

// Models
const User = require('./models/user');
const Dentist = require('./models/dentist');

// Register topics
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';
const registerErrorTopic = 'dentistimo/register/error';

// Login topics
const loginUserTopic = 'dentistimo/login/user';
const loginDentistTopic = 'dentistimo/login/dentist';
const loginErrorTopic = 'dentistimo/login/error';

// Modify and reset password topics
const modifyUserTopic = 'dentistimo/modify-user';
const modifyUserErrorTopic = 'dentistimo/modify-user/error';

const resetPasswordDentistTopic = 'dentistimo/reset-password/dentist';
const resetPasswordUserTopic = 'dentistimo/reset-password/user';
const resetPasswordErrorTopic = 'dentistimo/reset-password/error';

const sendEmailCodeTopic = 'dentistimo/send-email-code';
const sendEmailCodeErrorTopic = 'dentistimo/send-email-code/error';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Mongo setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(
    mongoURI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (err) {
        if (err) {
            console.error(`Failed to connect to MongoDB with URI: ${mongoURI}`);
            console.error(err.stack);
            process.exit(1);
        }
        console.log(`Connected to MongoDB with URI: ${mongoURI}`);
    }
);

// MQTT setup
const port = '8883';
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtts://${process.env.MQTT_BROKER}:${port}`;
const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USER_ID,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
});

// const client = mqtt.connect('mqtt://localhost'); // For development only

client.on('connect', () => {
    console.log('MQTT connected');

    const topics = [
        registerUserTopic,
        registerDentistTopic,
        loginUserTopic,
        loginDentistTopic,
        modifyUserTopic,
        resetPasswordDentistTopic,
        resetPasswordUserTopic,
        sendEmailCodeTopic,
    ];

    topics.forEach((topic) => {
        client.subscribe(topic, { qos: 2 }, () => {
            console.log(`Subscribed to topic '${topic}'`);
        });
    });
});

client.on('message', async (topic, payload) => {
    console.log(JSON.parse(payload.toString()).email);
    switch (topic) {
        case registerDentistTopic:
        case registerUserTopic:
            await registerUser(topic, payload);
            break;
        case loginDentistTopic:
        case loginUserTopic:
            login(topic, payload);
            break;
        case modifyUserTopic:
            modifyUser(topic, payload);
            break;
        case resetPasswordDentistTopic:
        case resetPasswordUserTopic:
            resetPassword(topic, payload);
            break;
        case sendEmailCodeTopic:
            sendEmailCode(topic, payload);
            break;
        default:
            console.log('Undefined topic');
    }
});

async function registerUser(topic, payload) {
    const start = hrtime();
    // Parse the payload and extract the user information
    const userInfo = JSON.parse(payload.toString());
    const { firstName, lastName, email, password, passwordCheck, requestId } =
        userInfo;
    let officeId;

    try {
        // If the topic is registerDentistTopic, extract the officeId field from the payload
        if (topic === registerDentistTopic) {
            officeId = userInfo.officeId;

            // Validate the officeId field
            if (!officeId) {
                const error = new Error('Office is required');
                client.publish(
                    `${registerErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }
        }

        // Validate the rest of the input fields
        if (!firstName || !lastName || !email || !password || !passwordCheck) {
            const error = new Error('All fields are required');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (!validator.validate(email)) {
            const error = new Error('Invalid email address');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (password !== passwordCheck) {
            const error = new Error('Passwords do not match');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }
        if (password.length < 8) {
            const error = new Error(
                'Password must be longer than 8 characters long'
            );
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }

        // Check if email is already registered
        let existingUser;
        if (topic === registerDentistTopic) {
            existingUser = await Dentist.findOne({ email });
        } else {
            existingUser = await User.findOne({ email });
        }
        if (existingUser) {
            const error = new Error('Email is already in use');
            client.publish(`${registerErrorTopic}/${requestId}`, error.message);
            throw error;
        }

        // Hash password and create new user
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        let newUser;
        if (topic == registerDentistTopic) {
            let dentistId = await generateUniqueUserId(10, true);
            console.log(dentistId);
            newUser = new Dentist({
                dentistId,
                firstName,
                lastName,
                email,
                password: passwordHash,
                officeId,
            });
        } else {
            let userId = await generateUniqueUserId(10, false);
            console.log(userId);
            newUser = new User({
                userId,
                firstName,
                lastName,
                email,
                password: passwordHash,
            });
        }

        const savedUser = await newUser.save();

        // Publish success or error message
        if (topic == registerDentistTopic) {
            client.publish(
                `${registerDentistTopic}/${requestId}`,
                JSON.stringify({
                    firstName: savedUser.firstName,
                    lastName: savedUser.lastName,
                    email: savedUser.email,
                    officeId: savedUser.officeId,
                })
            );
        } else {
            client.publish(
                `${registerUserTopic}/${requestId}`,
                JSON.stringify({
                    firstName: savedUser.firstName,
                    lastName: savedUser.lastName,
                    email: savedUser.email,
                })
            );
        }
        const end = hrtime(start);
        const elapsedTimeInSeconds = end[0] + end[1] / 1e9;
        console.log(`Elapsed time: ${elapsedTimeInSeconds} seconds`);
    } catch (error) {
        console.error('[register error]', error.message);
    }
}

async function login(topic, payload) {
    // Parse the payload and extract the email, password, and requestId
    let user;
    const { email, password, requestId } = JSON.parse(payload.toString());
    try {
        // Check if the email and password fields are present
        if (!email || !password) {
            // If either field is missing, throw an error and publish an error message
            const error = new Error('All fields are required');
            client.publish(`${loginErrorTopic}/${requestId}`, error.message);
            throw error;
        }

        // Check if the topic is for user or dentist logins
        if (topic == loginUserTopic) {
            // If the topic is for user logins, find the user with the matching email
            user = await User.findOne({ email });
            // If no user is found, throw an error and publish an error message
            if (!user) {
                const error = new Error('User name or password');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            // Validate the password
            let isMatch = await bcrypt.compare(password, user.password);
            // If the password is invalid, throw an error and publish an error message
            if (!isMatch) {
                const error = new Error('User name or password');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            // Create the JWT tokens object
            let tokens = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'User',
            };

            // Sign the JWT token
            let token = jwt.sign(tokens, process.env.JWT_SECRET, {
                issuer: 'Dentistimo-User-Management',
                audience: user._id.toString(),
                expiresIn: 3600,
            });

            // Publish the login success message with the JWT token
            client.publish(
                `${loginUserTopic}/${requestId}`,
                JSON.stringify({
                    IdToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    userId: user.userId,
                })
            );
        } else if (topic == loginDentistTopic) {
            // If the topic is for dentist logins, find the dentist with the matching email
            user = await Dentist.findOne({ email });
            // If no dentist is found, throw an error and publish an error message
            if (!user) {
                const error = new Error('User name or password');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            // Validate the password
            let isMatch = await bcrypt.compare(password, user.password);
            // If the password is invalid, throw an error and publish an error message
            if (!isMatch) {
                const error = new Error('User name or password');
                client.publish(
                    `${loginErrorTopic}/${requestId}`,
                    error.message
                );
                throw error;
            }

            // Create the JWT tokens object
            let tokens = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: 'Dentist',
            };

            // Sign the JWT token
            let token = jwt.sign(tokens, process.env.JWT_SECRET, {
                issuer: 'Dentistimo-User-Management',
                audience: user._id.toString(),
                expiresIn: 3600,
            });

            // Publish the login success message with the JWT token and company name
            client.publish(
                `${loginDentistTopic}/${requestId}`,
                JSON.stringify({
                    IdToken: token,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    officeId: user.officeId,
                    dentistId: user.dentistId,
                })
            );
        }
    } catch (error) {
        // Log any errors that occur
        console.log('[login]', error.message);
    }
}

async function modifyUser(topic, payload) {
    // Parse the payload into an object.
    let {
        idToken,
        oldPassword,
        newPassword,
        firstName,
        lastName,
        email,
        officeId,
    } = JSON.parse(payload.toString());
    let user;

    try {
        // Check if the idToken field is present
        if (!idToken) {
            // If the idToken field is missing, throw an error and publish an error
            // message
            const error = new Error('idToken is required');
            client.publish(`${modifyUserErrorTopic}/${idToken}`, error.message);
            throw error;
        }

        // Verify the idToken to retrieve the user's id.
        const { decoded, userId } = await verifyIdToken(idToken);
        console.log(decoded);

        // Find the user in the database.
        user = await findUser(userId, decoded.role);

        if (!user) {
            // If the user is not found, throw an error.
            const error = new Error('User not found');
            client.publish(`${modifyUserErrorTopic}/${idToken}`, error.message);
            throw error;
        }

        // Check that the new password is at least 8 characters long if it is provided.
        if (newPassword && newPassword.length < 8) {
            const error = new Error(
                'Password must be longer than 8 characters'
            );
            client.publish(`${modifyUserErrorTopic}/${idToken}`, error.message);
            throw error;
        }

        // Compare the provided password with the user's hashed password in the database.
        let isMatch = await comparePasswords(user, oldPassword);
        if (!isMatch) {
            // If the passwords do not match, throw an error.
            const error = new Error('Password is incorrect');
            client.publish(`${modifyUserErrorTopic}/${idToken}`, error.message);
            throw error;
        }

        let newPasswordHash;
        // Hash the new password if it is provided.
        if (newPassword) {
            let salt = await bcrypt.genSalt();
            newPasswordHash = await bcrypt.hash(newPassword, salt);
        }

        // Update the user in the database with the provided data.
        let updateResult;
        const options = { new: true };
        if (decoded.role == 'User') {
            updateResult = await User.findOneAndUpdate(
                { _id: userId },
                { firstName, lastName, email, password: newPasswordHash },
                options
            );
        } else {
            updateResult = await Dentist.findOneAndUpdate(
                { _id: userId },
                {
                    firstName,
                    lastName,
                    email,
                    password: newPasswordHash,
                    officeId,
                },
                options
            );
        }

        updateresult2 = await updateResult.save();
        console.log(updateresult2);

        if (!updateResult) {
            // If the update was unsuccessful, throw an error.
            const error = new Error('Failed to update user');
            client.publish(
                `${modifyUserErrorTopic}/${idToken}`,
                JSON.stringify({
                    updateStatus: 'Update failed',
                    error: error.message,
                })
            );
            throw error;
        }
        // If the update was successful, publish a message to the modifyPasswordTopic.
        client.publish(
            `${modifyUserTopic}/${idToken}`,
            JSON.stringify({
                updateStatus: 'Update successful',
                firstName: updateresult2.firstName,
                lastName: updateresult2.lastName,
                email: updateresult2.email,
                officeId: updateresult2.officeId,
            })
        );
    } catch (error) {
        // Log the errors.
        console.error('[modifyPassword]', error.message);
    }
}

async function verifyIdToken(idToken) {
    try {
        const decoded = jwt.verify(idToken, process.env.JWT_SECRET);
        console.log(decoded);
        return { decoded, userId: decoded.aud };
    } catch (error) {
        const invalidIdTokenError = new Error('Invalid idToken');
        throw invalidIdTokenError;
    }
}

async function findUser(userId, role) {
    let user;
    if (role === 'User') {
        user = await User.findOne({ _id: userId });
    } else {
        user = await Dentist.findOne({ _id: userId });
    }
    return user;
}

async function comparePasswords(user, password) {
    return await bcrypt.compare(password, user.password);
}

//Method 2:  Change password
async function resetPassword(topic, payload) {
    let { email, userCode, newPassword, requestId } = JSON.parse(
        payload.toString()
    );
    try {
        // Check if email is already registered
        let user;
        if (topic === registerDentistTopic) {
            user = await Dentist.findOne({ email });
        } else {
            user = await User.findOne({ email });
        }
        if (!user) {
            const error = new Error('Invalid email');
            client.publish(
                `${resetPasswordErrorTopic}/${requestId}`,
                error.message
            );
            throw error;
        }
        console.log('user.code: ' + user.code);
        console.log('userCode: ' + userCode);
        //Verify that the code is correct
        if (user.code != userCode)
            return client.publish(
                `${resetPasswordErrorTopic}/${requestId}`,
                'Invalid code'
            );

        if (newPassword.length < 8) {
            return client.publish(
                `${resetPasswordErrorTopic}/${requestId}`,
                'Password must be longer than 8 characters long'
            );
        }

        //Change password
        let salt = await bcrypt.genSalt();
        let passwordHash = await bcrypt.hash(newPassword, salt);

        console.log(user._id);

        let updateResult;
        if (topic === resetPasswordDentistTopic) {
            updateResult = await Dentist.findOneAndUpdate(
                { email: email },
                { password: passwordHash }
            );
            console.log(updateResult);
        } else if (topic === resetPasswordUserTopic) {
            updateResult = await User.findOneAndUpdate(
                { email: email },
                { password: passwordHash },
                { new: true, upsert: true }
            );
            console.log(updateResult);
        }
        if (!updateResult) {
            console.log(updateResult);
            return client.publish(
                `${resetPasswordErrorTopic}/${requestId}`,
                'Reset failed'
            );
        }
        console.log(user.password);

        if (topic === resetPasswordDentistTopic) {
            return client.publish(
                `${resetPasswordDentistTopic}/${requestId}`,
                'Reset successful'
            );
        } else if (topic === resetPasswordUserTopic) {
            return client.publish(
                `${resetPasswordUserTopic}/${requestId}`,
                'Reset successful'
            );
        }
    } catch (error) {
        console.error('[resetPassword]', error);
    }
}

async function sendEmailCode(topic, payload) {
    let { email, requestId } = JSON.parse(payload.toString());
    try {
        let user = await User.findOne({ email });
        if (!user)
            return client.publish(
                `${sendEmailCodeTopic}/${requestId}`,
                'An email has been sent if there is an account associated with that email'
            );

        let code = '';
        for (let i = 0; i < 6; i++) {
            code += parseInt(Math.random() * 10);
        }
        console.log('Code is: ' + code);

        sendEmail(
            transporter,
            email,
            'Reset password',
            'Heres the code for resetting your password:' + code
        );

        await User.updateOne({ email }, { code }, { upsert: true });
        return client.publish(
            `${sendEmailCodeTopic}/${requestId}`,
            'An email has been sent if there is an account associated with that email'
        );
    } catch (error) {
        console.error('[Send code]', error);
        client.publish(
            `${sendEmailCodeErrorTopic}/${requestId}`,
            error.message
        );
    }
}

console.log('running...');
