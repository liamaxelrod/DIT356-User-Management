// Models
const User = require('../models/user');
const Dentist = require('../models/dentist');

const loginDentistTopic = 'dentistimo/login/dentist';

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
    let user;
    if (topic === loginDentistTopic) {
        user = await Dentist.findOne({ email: email });
    } else {
        user = await User.findOne({ email: email });
    }
    return user;
}

module.exports = { findUserByEmail, findUserById };
