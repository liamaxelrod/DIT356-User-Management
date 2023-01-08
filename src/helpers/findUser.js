// Models
const User = require('../models/user');
const Dentist = require('../models/dentist');

// MQTT topics for dentists
const registerDentistTopic = 'dentistimo/register/dentist';
const loginDentistTopic = 'dentistimo/login/dentist';
const resetPasswordDentistTopic = 'dentistimo/reset-password/dentist';
const sendEmailCodeDentistTopic = 'dentistimo/send-email-code/dentist';

// Find user by ID and role (either 'User' or 'Dentist')
async function findUserById(userId, role) {
    let user;
    if (role === 'User') {
        user = await User.findOne({ userId: userId });
    } else {
        user = await Dentist.findOne({ dentistId: userId });
    }

    return user;
}

// Find user by email and topic
// If the topic is related to dentists, search in the Dentist collection
// Otherwise, search in the User collection
async function findUserByEmail(topic, email) {
    let user;
    if (
        topic === registerDentistTopic ||
        topic === loginDentistTopic ||
        topic === resetPasswordDentistTopic ||
        topic === sendEmailCodeDentistTopic
    ) {
        user = await Dentist.findOne({ email: email });
    } else {
        user = await User.findOne({ email: email });
    }
    return user;
}

module.exports = { findUserByEmail, findUserById };
