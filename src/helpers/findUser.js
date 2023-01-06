// Models
const User = require('../models/user');
const Dentist = require('../models/dentist');

const registerDentistTopic = 'dentistimo/register/dentist';
const loginDentistTopic = 'dentistimo/login/dentist';
const resetPasswordDentistTopic = 'dentistimo/reset-password/dentist';
const sendEmailCodeDentistTopic = 'dentistimo/send-email-code/dentist';

async function findUserById(userId, role) {
    let user;
    if (role === 'User') {
        user = await User.findOne({ userId: userId });
        console.log(user);
    } else {
        user = await Dentist.findOne({ dentistId: userId });
        console.log(user);
    }
    return user;
}

async function findUserByEmail(topic, email) {
    console.log(topic, email);
    let user;
    if (topic === registerDentistTopic || topic === loginDentistTopic || topic === resetPasswordDentistTopic || topic === sendEmailCodeDentistTopic) {
        user = await Dentist.findOne({ email: email });
        console.log(user);
    } else {
        user = await User.findOne({ email: email });
        console.log(user);
    }
    return user;
}

module.exports = { findUserByEmail, findUserById };
