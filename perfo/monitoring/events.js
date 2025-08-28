// This script will use browser to login SSO and re-use cookies for API calls /event/api/v1/events?page=0&size=25&sort=createdDate%2Cdesc x times
// set your environment variables for cso password like: $env:PLAYWRIGHT_CSO_PASSWORD = "<your_password>"
// To run this script, use the command: k6 run events.js

import { browser } from 'k6/browser';
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    ui: {
      //executor: 'shared-iterations',
      executor: 'per-vu-iterations',
      iterations: 30,
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // http errors should be less than 1%
    http_req_duration: ['p(95)<3000'], // 95 percent of response times must be below 3000ms
  },
};

// Global variable to store cookies
let globalCookies = null;
let jar=null;
const BASE_URL = 'https://cso-cim-qa1-np.cloudapps.telus.com';

export default async function () {
  

  // Only do login once per VU
  if (!globalCookies) {
    console.log('Starting login process');
    const user = "x359214"; //QA4_DTO_PRIME_XID
    const password = __ENV.PLAYWRIGHT_CSO_PASSWORD;

    if (!password) {
      console.log('Warning: PLAYWRIGHT_CSO_PASSWORD environment variable not set');
      globalCookies = [];
    } else {
      try {
        const page = await browser.newPage();

        await page.goto(`${BASE_URL}/event/en/events`, { waitUntil: 'networkidle' });
        await page.locator('input[id="username"]').type(user);
        await page.locator('input[id="password"]').type(password);
        await page.locator('button[data-label-ignore="login"]').click();
        await page.waitForNavigation();
        await page.waitForTimeout(2000); // Wait for login to process

        console.log('Getting cookies');
        globalCookies = await page.context().cookies();
        console.log(`Found ${globalCookies.length} cookies`);

        await page.close();
        
        console.log('Login completed successfully');
      } catch (error) {
        console.error('Error during login:', error);
        globalCookies = [];
      }
    }
    // Set cookies from cso-cim in the next cookie header
    jar = http.cookieJar();
    for (const c of globalCookies) {
      if (c.domain.includes('cso-cim-')) {
        console.log(`Setting cookie: ${c.domain}: ${c.name}=${c.value}`);
        jar.set(BASE_URL, c.name, c.value);
      }
    }
  }

  const res = http.get(`${BASE_URL}/event/api/v1/events?page=0&size=25&sort=createdDate%2Cdesc`, {jar: jar, redirects: 0});
  check(res, {'is status 200': (r) => r.status === 200}); //be sure we don't redirect to SSO page
  console.log(`Response code: ${res.status}`);

  sleep(1);
}
  
  