const jwt = require('jsonwebtoken');

const authenticationResponseTopic = 'dentistimo/authentication/response';

module.exports = {
    async handleVerifyIdTokenRequest(topic, payload, client) {
        console.log(payload.toString());
        // Extract the idToken and role from the payload
        const { idToken } = JSON.parse(payload.toString());

        // Verify the idToken
        try {
            const decoded = await jwt.verify(idToken, process.env.JWT_SECRET);
            console.log(decoded);
            // Check if the role in the JWT matches the role provided in the request
            if (decoded.role === 'User') {
                console.log('Authorized');
                // Send a response with the status "Authorized" and the ID of the token
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({
                        status: 'Authorized',
                        id: decoded.aud,
                        role: 'User'
                    })
                );
            } else if (decoded.role === 'Dentist') {
                console.log('Authorized');
                // Send a response with the status "Authorized" and the ID of the token
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({
                        status: 'Authorized',
                        id: decoded.aud,
                        role: 'Dentist'
                    })
                );
            } else {
                console.log('Unauthorized');
                // If the roles don't match, send a response with the status "Unauthorized"
                client.publish(
                    authenticationResponseTopic,
                    JSON.stringify({ status: 'Unauthorized' })
                );
            }
        } catch (error) {
            console.log('Unauthorized 2');
            // If the idToken is invalid, send a response with the status "Unauthorized"
            client.publish(
                authenticationResponseTopic,
                JSON.stringify({ status: 'Unauthorized' })
            );
        }
    },
};
