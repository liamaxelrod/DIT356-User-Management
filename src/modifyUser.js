const { getUserInfo } = require('./helpers/getUserInfo');
const { findUserById } = require('./helpers/findUser');

const modifyUserErrorTopic = 'dentistimo/modify-user/error';
const modifyUserTopic = 'dentistimo/modify-user';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function modifyUser(client, topic, payload) {
    let user;

    try {
        // Parse the payload and extract the user information
        const userInfo = getUserInfo(payload);
        if (!userInfo) throw new Error('Invalid JSON');
        console.log(payload.toString());
        // Parse the payload into an object.
        let {
            idToken,
            oldPassword,
            newPassword,
            firstName,
            lastName,
            email,
            officeId,
        } = userInfo;
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

        // Find the user in the database.
        user = await findUserById(userId, decoded.role);
        console.log(user);

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
        console.log(user.password);
        let isMatch = await comparePasswords(user.password, oldPassword);
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
                { userId: userId },
                { firstName, lastName, email, password: newPasswordHash },
                options
            );
        } else {
            updateResult = await Dentist.findOneAndUpdate(
                { dentistId: userId },
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

        await updateResult.save();
        console.log(updateResult);

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
                firstName: updateResult.firstName,
                lastName: updateResult.lastName,
                email: updateResult.email,
                officeId: updateResult.officeId,
            })
        );
    } catch (error) {
        // Log the errors.
        console.error('[modifyPassword]', error);
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

async function comparePasswords(hash, password) {
    let result = await bcrypt.compare(password, hash);
    console.log(result);
    return result;
}

module.exports = { modifyUser };
