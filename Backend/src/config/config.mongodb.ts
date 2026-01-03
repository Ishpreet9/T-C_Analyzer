import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        const conn = await mongoose.connect(uri);
        console.log("MongoDB Connected: ", conn.connection.host);
    } catch (error) {
        if(error instanceof Error)
        {
            console.error('Error connecting to MongoDB: ', error);
        }
        else
        {
            console.error("Unknown error connecting to MongoDB");
        }
    }
}

export default connectDB;
