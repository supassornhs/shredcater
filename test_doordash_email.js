import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

dotenv.config();

const config = {
    imap: {
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false }
    }
};

async function run() {
    console.log("🚀 Pulling the last Doordash email for analysis...");

    imaps.connect(config).then(function (connection) {
        return connection.openBox('INBOX').then(function () {
            
            // Search criteria: Any email with Doordash in subject
            const searchCriteria = [
                ['SUBJECT', 'Doordash']
            ];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false
            };

            return connection.search(searchCriteria, fetchOptions).then(async function (messages) {
                if (messages.length === 0) {
                    console.log("No Doordash emails found.");
                    process.exit(0);
                } 
                
                // Grab the single most recent Doordash email
                let item = messages[messages.length - 1]; 
                let all = item.parts.find(p => p.which === '');
                let subjectHeader = item.parts.find(p => p.which === 'HEADER').body.subject[0] || '';
                
                try {
                    let parsedMail = await simpleParser(all.body);
                    let bodyText = parsedMail.text || "";
                    let combinedText = subjectHeader + "\n\n" + bodyText;

                    console.log("============= RAW DOORDASH EMAIL =============");
                    console.log(combinedText.substring(0, 1500)); // Print top 1500 chars so we can analyze the layout!
                    console.log("==============================================");
                    
                } catch(e) { console.error("Error parsing", e); }
                
                connection.end();
            });
        });
    }).catch(console.error);
}

run();
