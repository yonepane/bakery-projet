import mongoose from 'mongoose';

const MASTER_DB_URI = process.env.MASTER_DB_URI || 'mongodb://localhost:27017/bakery-master';

export const connectMasterDB = async () => {
  try {
    await mongoose.connect(MASTER_DB_URI);
    console.log('Connected to Master Database');
  } catch (error) {
    console.error('Master Database connection error:', error);
    process.exit(1);
  }
};

export default connectMasterDB;
