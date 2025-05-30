// hash_password.js
const bcrypt = require('bcryptjs');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('Enter the plaintext password to hash: ', async (plaintextPassword) => {
  if (!plaintextPassword) {
    console.error('No password entered. Exiting.');
    readline.close();
    return;
  }

  try {
    const saltRounds = 10; // Must match the saltRounds used in your server.js
    const hashedPassword = await bcrypt.hash(plaintextPassword, saltRounds);
    console.log('\nPlaintext Password:', plaintextPassword);
    console.log('Bcrypt Hashed Password:', hashedPassword);
    console.log('\nCopy the hashed password above and update it in your database.');
  } catch (error) {
    console.error('Error hashing password:', error);
  } finally {
    readline.close();
  }
});
