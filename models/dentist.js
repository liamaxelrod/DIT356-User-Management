const mongoose = require('mongoose');

const dentistSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 8 },
    companyName: { type: String, required: true },
});

module.exports = Dentist = mongoose.model('dentist', dentistSchema);
