const secureDns = "https://appe-buntu.top";
const user = "iptv99241";
const pass = "s60977";

async function test() {
  const streamId = "189668";
  const tsUrl = `${secureDns}/live/${user}/${pass}/${streamId}.ts`;

  console.log(`Testing OPTIONS request: ${tsUrl}`);
  try {
    const res = await fetch(tsUrl, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "range",
        "Origin": "https://smarthubplaysite.online",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      redirect: "follow",
    });
    console.log(`OPTIONS Status: ${res.status}`);
    console.log(`OPTIONS Headers:`, Object.fromEntries(res.headers.entries()));
    const body = await res.text();
    console.log(`OPTIONS Body length: ${body.length}`);
    console.log(`OPTIONS Body:`, body.slice(0, 500));
  } catch (err) {
    console.error("OPTIONS request error:", err.message);
  }
}

test();
