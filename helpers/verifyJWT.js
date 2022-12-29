const jwt = require('jsonwebtoken');

module.exports = {
    async verifyJWT(payload) {
        let decoded;
        let { idToken } = JSON.parse(payload.toString());

        // Check if the payload contains a token
        if (!idToken) {
            throw new Error('No token provided');
        }
        // Verify the token, throw error if invalid
        jwt.verify(
            idToken,
            process.env.JWT_SECRET,
            function (err, decodedToken) {
                if (err) {
                    throw new Error('Invalid token');
                } else {
                    return (decoded = decodedToken);
                }
            }
        );
        return decoded;
    },
};
