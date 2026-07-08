
async function main() {
  const baseUrl = "https://firestore.googleapis.com/v1/projects/cogent-woodland-x9z5m/databases/ai-studio-a807d10e-b26a-4c76-90b4-c26febef321c/documents";
  
  try {
    console.log('Fetching users...');
    const resUsers = await fetch(`${baseUrl}/users`);
    if (!resUsers.ok) {
      const errText = await resUsers.text();
      console.error('Failed to fetch users:', resUsers.status, errText);
      return;
    }
    const userData = await resUsers.json();
    const userDocs = userData.documents || [];
    console.log(`Found ${userDocs.length} users in the first page.`);
    
    for (const doc of userDocs) {
        const fields = doc.fields || {};
        const name = fields.name?.stringValue || "";
        const email = fields.email?.stringValue || "";
        
        console.log(`User: ${name} (${email}) | ID: ${doc.name.split('/').pop()}`);
        
        if (name.toLowerCase().includes('hassan')) {
            console.log('--- User Info for Hassan ---');
            console.log('UID:', doc.name.split('/').pop());
            console.log('Name:', name);
            console.log('Balance components:', {
                signupBonus: fields.signupBonus?.doubleValue || fields.signupBonus?.integerValue || 0,
                dailyBonusEarnings: fields.dailyBonusEarnings?.doubleValue || fields.dailyBonusEarnings?.integerValue || 0,
            });
        }
    }

  } catch (err) {
    console.error('Error in debug script:', err);
  }
}

main();
