const { Client } = require('pg');

const project = 'xhrfpecpiooxzkhpemfn';
const password = 'EOjC8RP6pQ7cmaTp';

const regions = [
    'aws-0-eu-central-1', // Frankfurt
    'aws-0-us-east-1',    // N. Virginia (US)
    'aws-0-eu-west-1',    // Ireland
    'aws-0-eu-west-2',    // London
    'aws-0-eu-west-3',    // Paris
    'aws-0-ap-southeast-1', // Singapore
    'aws-0-us-west-1',    // California
    'aws-0-sa-east-1'     // Brazil
];

console.log("🕵️‍♂️ Supabase Bölgesi Aranıyor...");

async function checkRegion(region) {
    const connectionString = `postgresql://postgres.${project}:${password}@${region}.pooler.supabase.com:6543/postgres`;
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
    try {
        // console.log(`Testing ${region}...`);
        await client.connect();
        console.log(`\n🎉 BULUNDU! Senin Bölgen: ${region}`);
        console.log(`✅ Bağlantı Başarılı!`);
        await client.end();
        process.exit(0); // Başarılı, çık
    } catch (e) {
        process.stdout.write("."); // Hata ise nokta koy devam et
        await client.end().catch(() => { });
    }
}

async function run() {
    for (const r of regions) {
        await checkRegion(r);
    }
    console.log('\n❌ Hiçbir bölgede bulunamadı! Şifre veya Proje ID yanlış olabilir.');
}

run();
