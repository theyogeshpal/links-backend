const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const cleanDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/links';
    console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}...`);
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;

    // Collections to wipe completely
    const collectionsToClear = [
      'projects',
      'companies',
      'contacts',
      'contacttypes',
      'studytypes',
      'projectqualifications',
      'projectquotas',
      'projectsuppliers',
      'surveysessions',
      'vendorredirects',
      'clientcodes'
    ];

    console.log('\n--- Cleaning Database Collections ---');
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    for (const colName of collectionsToClear) {
      if (existingCollections.includes(colName)) {
        const result = await db.collection(colName).deleteMany({});
        console.log(`✓ Cleared collection: [${colName}] -> ${result.deletedCount} documents deleted`);
      } else {
        console.log(`- Collection [${colName}] does not exist (skipped)`);
      }
    }

    // Preserve Admin Credentials in 'users' collection
    if (existingCollections.includes('users')) {
      const nonAdminResult = await db.collection('users').deleteMany({ role: { $ne: 'Admin' } });
      const adminCount = await db.collection('users').countDocuments({ role: 'Admin' });
      console.log(`✓ Preserved Admin user(s) in [users]: ${adminCount} remaining (deleted ${nonAdminResult.deletedCount} non-admin users)`);
      
      const adminUser = await db.collection('users').findOne({ role: 'Admin' }, { projection: { email: 1, role: 1 } });
      if (adminUser) {
        console.log(`  -> Active Admin Identity: Email = ${adminUser.email}, Role = ${adminUser.role}`);
      }
    }

    console.log('\n Database cleaning completed successfully! Only admin credentials remain intact.\n');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning database:', error);
    process.exit(1);
  }
};

cleanDatabase();
