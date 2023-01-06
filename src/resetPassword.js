const { sendEmail } = require('./email.js');
const { getUserInfo } = require('./helpers/getUserInfo.js');
const { findUserByEmail } = require('./helpers/findUser');

const resetPasswordErrorTopic = 'dentistimo/reset-password/error';
const sendEmailCodeErrorTopic = 'dentistimo/send-email-code/error';
const resetPasswordDentistTopic = 'dentistimo/reset-password/dentist';
const resetPasswordUserTopic = 'dentistimo/reset-password/user';
const sendEmailCodeDentistTopic = 'dentistimo/send-email-code/dentist';
const sendEmailCodeUserTopic = 'dentistimo/send-email-code/user';

const bcrypt = require('bcrypt');

async function resetPassword(client, topic, payload) {
    try {
        console.log(payload.toString());
        // Parse the payload and extract the user information
        const userInfo = await getUserInfo(payload);
        if (!userInfo) throw new Error('Invalid JSON');
        // Parse the payload into an object.
        const { newPassword, email, userCode, requestId } = userInfo;
        // Check if email is already registered
        let user = await findUserByEmail(topic, email);
        if (!user) {
            const error = new Error('Invalid email');
            client.publish(
                `${resetPasswordErrorTopic}/${requestId}`,
                error.message
            );
            throw error;
        }

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
        user.code = undefined;
        user.save();

        if (topic === resetPasswordDentistTopic) {
            return client.publish(
                `${resetPasswordDentistTopic}/${requestId}`,
                'Reset successful'
            );
        } else if (topic === resetPasswordUserTopic) {
            return client.publish(
                `${resetPasswordUserTopic}/${requestId}`,
                '{"status": "reset successful"}'
            );
        }
    } catch (error) {
        console.error('[resetPassword]', error);
    }
}

async function sendEmailCode(client, transporter, topic, payload) {
    console.log(payload.toString());
    try {
        // Parse the payload and extract the user information
        const userInfo = getUserInfo(payload);
        if (!userInfo) throw new Error('Invalid JSON');
        // Parse the payload into an object.
        let { email, requestId } = userInfo;

        console.log(userInfo);
        let user = await findUserByEmail(topic, email);
        console.log(user);
        if (!user) {
            if (topic === sendEmailCodeDentistTopic) {
                return client.publish(
                    `${sendEmailCodeDentistTopic}/${requestId}`,
                    'An email has been sent if there is an account associated with that email'
                );
            } else {
                return client.publish(
                    `${sendEmailCodeUserTopic}/${requestId}`,
                    'An email has been sent if there is an account associated with that email'
                );
            }
        }

        let code = '';
        for (let i = 0; i < 6; i++) {
            code += parseInt(Math.random() * 10);
        }
        console.log('Code is: ' + code);

        // Send an email to the user with the code
        sendEmail(
            transporter,
            email,
            'Reset password',
            'Heres the code for resetting your password:' + code
        );

        if (topic === sendEmailCodeDentistTopic) {
            await Dentist.updateOne({ email }, { code }, { upsert: true });
            return client.publish(
                `${sendEmailCodeDentistTopic}/${requestId}`,
                'An email has been sent if there is an account associated with that email'
            );
        } else {
            await User.updateOne({ email }, { code }, { upsert: true });
            return client.publish(
                `${sendEmailCodeUserTopic}/${requestId}`,
                'An email has been sent if there is an account associated with that email'
            );
        }
    } catch (error) {
        console.error('[Send code]', error);
        client.publish(
            `${sendEmailCodeErrorTopic}/${requestId}`,
            error.message
        );
    }
}

module.exports = { sendEmailCode, resetPassword };
