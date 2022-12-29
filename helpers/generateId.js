const User = require('../models/user');
const Dentist = require('../models/dentist');


module.exports = {
  // Extremely slow if many users are registering at once and there's already a lot of registered users.
    async generateUniqueUserId(length, isDentist) {
      // Generate a random number of the desired length
      let id = Math.floor(Math.random() * (Math.pow(10, length) - Math.pow(10, length-1))) + Math.pow(10, length-1);
  
      // Check if the ID is unique in the relevant collection (User or Dentist)
      let result;
      if (isDentist) {
        result = await Dentist.findOne({ dentistId: id });
      } else {
        result = await User.findOne({ userId: id });
      }
      if (result) {
        // If the ID is not unique, generate a new one
        console.log('ID generation error: ' + id + 'At object: ' + result);
        return module.exports.generateUniqueUserId(length, isDentist);
      }
  
      // Return the unique ID
      return id;
    },
  };
