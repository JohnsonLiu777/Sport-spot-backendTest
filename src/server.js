const Hapi = require('@hapi/hapi');
const admin = require('firebase-admin');
const serviceAccount = require('../sport-spot-test-firebase-adminsdk-rm4mp-9d1246a3d2.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const init = async () => {
    const server = Hapi.server({
        port: 9000,
        host: 'localhost'
    });

    // Middleware untuk otorisasi berdasarkan role
    const checkRole = (role) => {
        return async (request, h) => {
            const idToken = request.headers.authorization.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                if (decodedToken.role !== role) {
                    return h.response({ message: 'Access denied' }).code(403);
                }
                return h.continue;
            } catch (error) {
                return h.response({ message: 'Unauthorized' }).code(401);
            }
        };
    };

    // Endpoint registrasi
    server.route({
        method: 'POST',
        path: '/register',
        handler: async (request, h) => {
            const { email, password, displayName, role } = request.payload;

            try {
                const userRecord = await admin.auth().createUser({
                    email: email,
                    password: password,
                    displayName: displayName,
                });

                // Set custom claims (role)
                await admin.auth().setCustomUserClaims(userRecord.uid, { role: role });

                return h.response({
                    message: 'User created successfully',
                    user: {
                        uid: userRecord.uid,
                        email: userRecord.email,
                        displayName: userRecord.displayName,
                        role: role
                    }
                }).code(201);
            } catch (error) {
                return h.response({
                    message: 'User creation failed',
                    error: error.message,
                }).code(400);
            }
        }
    });

    // Endpoint login
    server.route({
        method: 'POST',
        path: '/login',
        handler: async (request, h) => {
            const { email, password } = request.payload;

            try {
                const user = await admin.auth().getUserByEmail(email);
                
                // Note: Firebase Admin SDK does not support password verification.
                // Password verification should be done on the client-side using Firebase Authentication SDK.
                // Here, we're just simulating a successful login for the purpose of demonstration.

                return h.response({
                    message: 'Login successful',
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                    }
                }).code(200);
            } catch (error) {
                return h.response({
                    message: 'Login failed',
                    error: error.message,
                }).code(401);
            }
        }
    });

    // Endpoint untuk menambahkan data lapangan, hanya untuk pemilik lapangan
    server.route({
        method: 'POST',
        path: '/addField',
        options: {
            pre: [checkRole('owner')],
            handler: async (request, h) => {
                const { fieldName, location, price, ownerId } = request.payload;

                try {
                    const docRef = db.collection('fields').doc();
                    await docRef.set({
                        fieldName: fieldName,
                        location: location,
                        price: price,
                        ownerId: ownerId,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    return h.response({ message: 'Field added successfully' }).code(201);
                } catch (error) {
                    return h.response({ message: 'Error adding field', error: error.message }).code(400);
                }
            }
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();