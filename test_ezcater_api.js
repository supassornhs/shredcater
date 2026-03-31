import dotenv from 'dotenv';
dotenv.config();

const EZCATER_TOKEN = process.env.EZCATER_TOKEN;
const GRAPHQL_ENDPOINT = 'https://api.ezcater.com/graphql';

if (!EZCATER_TOKEN) {
  console.error('❌ EZCATER_TOKEN is missing from .env!');
  process.exit(1);
}

const decoded = Buffer.from(EZCATER_TOKEN, 'base64').toString('utf-8');
const [email, apiKey] = decoded.split(':');
console.log('🔑 Decoded token → Email:', email);
console.log('   API Key:', apiKey?.substring(0, 12) + '...');

// Common headers needed to pass Cloudflare
const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://ezmanage.ezcater.com',
  'Referer': 'https://ezmanage.ezcater.com/',
  'Apollographql-client-name': 'HolyShred-ShredCater',
  'Apollographql-client-version': '1.0.0',
};

const simpleQuery = JSON.stringify({ query: `query AuthCheck { __typename }` });

async function testAuth(label, authValue) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🧪 ${label}`);
  console.log(`   Auth: ${authValue.substring(0, 40)}...`);

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { ...BASE_HEADERS, 'Authorization': authValue },
      body: simpleQuery,
    });

    console.log(`   Status: ${res.status} ${res.statusText}`);
    const text = await res.text();

    if (text.includes('<!doctype html') || text.includes('Cloudflare')) {
      console.log('   ❌ Blocked by Cloudflare');
      return false;
    }

    try {
      const json = JSON.parse(text);
      if (json.data) {
        console.log('   ✅ SUCCESS! Response:', JSON.stringify(json.data));
        return true;
      }
      if (json.errors) {
        console.log('   ⚠️  GraphQL error:', json.errors[0]?.message || JSON.stringify(json.errors));
        return false;
      }
    } catch (e) {
      console.log('   Response (raw):', text.substring(0, 300));
    }
    return false;
  } catch (err) {
    console.log('   🚨 Network error:', err.message);
    return false;
  }
}

async function runIntrospection(authHeader) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('📋 Running Schema Introspection...');
  console.log('═'.repeat(50));

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { ...BASE_HEADERS, 'Authorization': authHeader },
    body: JSON.stringify({
      query: `query DiscoverSchema {
        __schema {
          queryType {
            fields {
              name
              description
              args { name type { name kind ofType { name kind } } }
              type { name kind ofType { name kind } }
            }
          }
        }
      }`
    }),
  });

  const json = await res.json();
  if (json.data) {
    const queries = json.data.__schema?.queryType?.fields || [];
    console.log(`\n📋 Found ${queries.length} available queries:`);
    queries.forEach(q => {
      const returnType = q.type?.name || q.type?.ofType?.name || q.type?.kind;
      const args = q.args?.map(a => `${a.name}: ${a.type?.name || a.type?.ofType?.name || '?'}`).join(', ') || 'none';
      console.log(`   • ${q.name}(${args}) → ${returnType}`);
      if (q.description) console.log(`     "${q.description}"`);
    });
  }

  // Also discover Order type
  const res2 = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { ...BASE_HEADERS, 'Authorization': authHeader },
    body: JSON.stringify({
      query: `query DiscoverOrderType {
        __type(name: "Order") {
          name
          fields {
            name
            type { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }`
    }),
  });

  const json2 = await res2.json();
  if (json2.data?.__type) {
    const fields = json2.data.__type.fields || [];
    console.log(`\n📦 Order type has ${fields.length} fields:`);
    fields.forEach(f => {
      const t = f.type?.name || f.type?.ofType?.name || f.type?.ofType?.ofType?.name || f.type?.kind;
      console.log(`   • ${f.name}: ${t}`);
    });
  }
}

async function main() {
  // Try multiple auth header formats
  const authFormats = [
    { label: 'Raw token (as-is)',       value: EZCATER_TOKEN },
    { label: 'Basic <token>',           value: `Basic ${EZCATER_TOKEN}` },
    { label: 'Bearer <token>',          value: `Bearer ${EZCATER_TOKEN}` },
    { label: 'Just the API key',        value: apiKey },
    { label: 'Bearer <apiKey>',         value: `Bearer ${apiKey}` },
  ];

  let workingAuth = null;

  for (const fmt of authFormats) {
    const success = await testAuth(fmt.label, fmt.value);
    if (success) {
      workingAuth = fmt.value;
      console.log(`\n🎉 FOUND WORKING AUTH FORMAT: "${fmt.label}"`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000)); // brief pause between tries
  }

  if (!workingAuth) {
    console.log('\n❌ None of the auth formats worked.');
    console.log('   Your token may be expired. Go to ezManage → Integrations to generate a new one.');
    process.exit(1);
  }

  // Run introspection with the working auth
  await runIntrospection(workingAuth);
  
  console.log('\n🏁 Done!');
}

main();
