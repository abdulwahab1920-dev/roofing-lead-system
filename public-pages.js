"use strict";

// TODO: A lawyer should review the Privacy Policy and Terms of Service
// rendered here before launch. See legal.js for the contact addresses.

const { LEGAL, smsConsentHtml } = require("./legal");
const { COMPANY_NAME, COMPANY_LOCATION, SERVICE_AREA } = require("./company");

const LAWYER_TODO =
  "<!-- TODO: A lawyer should review this page before launch. This is a plain-language draft, not legal advice. -->";

function productLogo() {
  return `<span class="logo">
    <svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 18 L16 7 L28 18 V26 H4 Z" fill="currentColor" opacity="0.18"/>
      <path d="M4 18 L16 7 L28 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M10 26 V16.5 L16 11.5 L22 16.5 V26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
    </svg>
    <span class="logo-text">
      <strong>${LEGAL.productName}</strong>
      <span>${LEGAL.vendorName}</span>
    </span>
  </span>`;
}

module.exports = function createPublicPages({ layout, escapeHtml, publicFooter, fieldError }) {
  function marketingHeader() {
    return `<header class="site-header">
      <div class="wrap header-inner">
        <a class="logo-link" href="/">${productLogo()}</a>
        <nav class="public-nav" aria-label="Product">
          <a href="/#benefits">Benefits</a>
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#request-pilot">Request a pilot</a>
          <a href="/inspection">Homeowner form</a>
        </nav>
      </div>
    </header>`;
  }

  function landingPage({ values = {}, errors = {}, banner, pilotSent = false } = {}) {
    const v = (name) => escapeHtml(values[name] || "");
    const invalid = (name) => (errors[name] ? " invalid" : "");
    const bannerHtml = banner ? `<div class="banner error">${escapeHtml(banner)}</div>` : "";
    const thanks = pilotSent
      ? `<div class="banner ok" role="status">Thanks. Your pilot request is saved. We will reply to the email you entered.</div>`
      : "";

    const body = `
    ${marketingHeader()}
    <main class="market">
      ${banner ? `<div class="wrap form-alert">${bannerHtml}<p><a href="#request-pilot">The pilot form is below.</a></p></div>` : ""}
      <section class="market-hero">
        <div class="wrap">
          <p class="eyebrow">For small US residential roofers</p>
          <h1>Never lose a website or storm lead.</h1>
          <p class="lede">Roofing Lead CRM keeps inspection requests, photos, and follow-ups in one place. We are about to run free pilots. After a pilot, paid plans start with a 14-day free trial at $49 or $99 a month.</p>
          <div class="hero-actions">
            <a class="btn secondary" href="#request-pilot">Request a pilot</a>
            <a class="btn ghost" href="/inspection">Open the homeowner form</a>
          </div>
          <p class="hero-note">No card on this page. No customer count to brag about. This is the product we are taking into pilots.</p>
        </div>
      </section>

      <section class="wrap market-section" id="benefits">
        <h2>What you actually get</h2>
        <div class="benefit-grid">
          <article>
            <h3>Website and storm requests in one list</h3>
            <p>A homeowner’s name, phone, email, property address, notes, and photos land on a lead. They do not sit in a forgotten inbox.</p>
          </article>
          <article>
            <h3>A follow-up task on every new lead</h3>
            <p>The task list splits overdue, due today, upcoming, and completed. A storm request does not wait until someone remembers it.</p>
          </article>
          <article>
            <h3>An email when a request comes in</h3>
            <p>Once a sender is configured, the office gets an email alert. The lead is still saved if email is not set up yet.</p>
          </article>
          <article>
            <h3>Bring the spreadsheet with you</h3>
            <p>Import a CSV of leads you already have. Export the list when you want a copy for yourself.</p>
          </article>
        </div>
      </section>

      <section class="wrap market-section" id="how">
        <h2>How it works</h2>
        <ol class="step-grid">
          <li><span>1</span><div><h3>Share the inspection form</h3><p>Put the link on your website, or send it after a storm. Homeowners can also open <a href="/inspection">the form</a> on this site.</p></div></li>
          <li><span>2</span><div><h3>The request shows up with a task</h3><p>You see who asked for help, the address, any photos, and when to follow up.</p></div></li>
          <li><span>3</span><div><h3>Work it until it is won or lost</h3><p>Update the status, add notes, check off the task, and export if you need a spreadsheet.</p></div></li>
        </ol>
      </section>

      <section class="wrap market-section" id="pricing">
        <h2>Pricing after the pilot</h2>
        <p class="lede">Free pilots come first. We are not charging cards here. A paid plan, when you choose one, starts with a 14-day free trial. Cancel anytime.</p>
        <div class="price-grid">
          <article class="price-card">
            <h3>Starter</h3>
            <p class="price"><strong>$49</strong><span>/ month</span></p>
            <p>Up to 2 users. 14-day free trial.</p>
            <ul>
              <li>Inspection form, dashboard, and lead list</li>
              <li>Follow-up tasks</li>
              <li>Email alerts</li>
              <li>CSV import and export</li>
            </ul>
          </article>
          <article class="price-card price-crew">
            <h3>Crew</h3>
            <p class="price"><strong>$99</strong><span>/ month</span></p>
            <p>Up to 5 users. 14-day free trial.</p>
            <ul>
              <li>Everything in Starter</li>
              <li>SMS alerts</li>
              <li>Estimate PDF</li>
            </ul>
          </article>
        </div>
        <p class="fine-print">SMS alerts and estimate PDFs are part of the $99 plan. They are not switched on in this version. This CRM also uses one shared staff login, not a separate password per person. See the questions below.</p>
      </section>

      <section class="wrap market-section" id="faq">
        <h2>Questions</h2>
        <div class="faq">
          <details>
            <summary>Is this already sold to a list of roofers?</summary>
            <p>No. We are about to run free pilots with small US residential roofers. We are not publishing a customer count because we do not have one.</p>
          </details>
          <details>
            <summary>What does a homeowner submit?</summary>
            <p>Name, phone, email, property address, property type, roof type, the service they need, timing, notes, and optional photos. If they ask to be texted, they also have to agree to calls and texts. The <a href="/privacy">Privacy Policy</a> lists this in full.</p>
          </details>
          <details>
            <summary>Do you sell homeowner information?</summary>
            <p>No. The roofing company that owns the form can see its own leads. We share data with the email provider that sends office alerts, and with a text-message provider only if texts are later turned on.</p>
          </details>
          <details>
            <summary>Are SMS alerts and estimate PDFs working today?</summary>
            <p>They are included in the $99 plan. They are not switched on in this version. Ask us before a pilot depends on a text alert or a PDF estimate.</p>
          </details>
          <details>
            <summary>How do the user limits work?</summary>
            <p>Starter is priced for up to 2 people and Crew for up to 5. This version has one shared staff login. We will not charge you for separate seats this version cannot keep apart.</p>
          </details>
          <details>
            <summary>How do I cancel?</summary>
            <p>Email <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a>. A free pilot has nothing to bill. A paid plan is month to month after the 14-day trial. Cancel anytime before the next month starts.</p>
          </details>
          <details>
            <summary>Where is the homeowner form?</summary>
            <p>It is at <a href="/inspection">/inspection</a>. During a pilot we put your company name on it. The sample on this server currently says ${escapeHtml(COMPANY_NAME)}${SERVICE_AREA ? `, serving ${escapeHtml(SERVICE_AREA)}` : ""}.</p>
          </details>
        </div>
      </section>

      <section class="wrap market-section" id="request-pilot">
        <div class="form-card pilot-card">
          <h2>Request a pilot</h2>
          <p>Tell us how to reach you. We store the request and show it in the CRM notifications list. This does not start billing.</p>
          ${thanks}
          ${bannerHtml}
          <form method="post" action="/pilot">
            <div class="hp-field" aria-hidden="true">
              <label for="pilot_leave_blank">Leave this blank</label>
              <input id="pilot_leave_blank" name="leave_blank" type="text" tabindex="-1" autocomplete="off" value="">
            </div>
            <div class="field">
              <label for="pilot_name">Your name</label>
              <input id="pilot_name" name="full_name" type="text" required maxlength="120" autocomplete="name" value="${v("full_name")}" class="${invalid("full_name")}">
              ${fieldError(errors, "full_name")}
            </div>
            <div class="two-col">
              <div class="field">
                <label for="pilot_email">Work email</label>
                <input id="pilot_email" name="email" type="email" required maxlength="120" autocomplete="email" value="${v("email")}" class="${invalid("email")}">
                ${fieldError(errors, "email")}
              </div>
              <div class="field">
                <label for="pilot_phone">Phone <span class="opt">Optional</span></label>
                <input id="pilot_phone" name="phone" type="tel" maxlength="30" autocomplete="tel" value="${v("phone")}" class="${invalid("phone")}">
                ${fieldError(errors, "phone")}
              </div>
            </div>
            <div class="two-col">
              <div class="field">
                <label for="pilot_company">Company name</label>
                <input id="pilot_company" name="company_name" type="text" required maxlength="160" value="${v("company_name")}" class="${invalid("company_name")}">
                ${fieldError(errors, "company_name")}
              </div>
              <div class="field">
                <label for="pilot_city">City <span class="opt">Optional</span></label>
                <input id="pilot_city" name="city" type="text" maxlength="80" autocomplete="address-level2" value="${v("city")}" class="${invalid("city")}">
                ${fieldError(errors, "city")}
              </div>
            </div>
            <div class="field">
              <label for="pilot_note">What should we know? <span class="opt">Optional</span></label>
              <textarea id="pilot_note" name="note" maxlength="2000" rows="4">${v("note")}</textarea>
            </div>
            <button type="submit" class="btn primary">Send pilot request</button>
            <p class="fine-print">Or email <a href="mailto:${escapeHtml(LEGAL.pilotsEmail)}">${escapeHtml(LEGAL.pilotsEmail)}</a>.</p>
          </form>
        </div>
      </section>
    </main>
    ${publicFooter()}`;

    return layout({
      title: `${LEGAL.productName} | Never lose a website or storm lead`,
      body,
    });
  }

  function privacyPage() {
    const email = escapeHtml(LEGAL.privacyEmail);
    const company = escapeHtml(COMPANY_NAME);
    const where = COMPANY_LOCATION ? ` in ${escapeHtml(COMPANY_LOCATION)}` : "";
    const body = `
    ${LAWYER_TODO}
    ${marketingHeader()}
    <main class="wrap legal-doc">
      <p class="eyebrow">Privacy Policy</p>
      <h1>Privacy Policy</h1>
      <p class="muted">Last updated ${escapeHtml(LEGAL.updated)}. ${escapeHtml(LEGAL.vendorName)} wrote this in plain language for the ${escapeHtml(LEGAL.productName)} pilot.</p>

      <h2>Who we are</h2>
      <p>${escapeHtml(LEGAL.vendorName)} makes ${escapeHtml(LEGAL.productName)}, the software behind this website. The roofing company that owns the inspection form is the business a homeowner is contacting. On this server that company name is ${company}${where}. If a roofer is running a pilot, their own company name appears on the form.</p>

      <h2>Information the inspection form collects</h2>
      <p>When a homeowner sends an inspection request, we collect:</p>
      <ul>
        <li>Name</li>
        <li>Phone number</li>
        <li>Email address</li>
        <li>Property address: street, city, state, and ZIP code</li>
        <li>Property type, roof type, the service they need, and how soon they need it</li>
        <li>Notes about the roof</li>
        <li>Photos they choose to upload</li>
        <li>How they want to be contacted: call, text, or email</li>
      </ul>
      <p>If they check the calls-and-texts box, we also store that they agreed, the exact consent wording, a version label for that wording, the time, and the IP address of the submission. The box is not checked for them.</p>
      <p>Phone is required for a call or a text. Email is required when they choose email. Photos and notes are optional. The consent box is required only when they ask to be texted.</p>

      <h2>Information a pilot request collects</h2>
      <p>If a roofing company asks for a pilot, we collect the name, email, company name, and any phone, city, or note they type. We store that request so we can reply. We also add a line to the staff notifications list inside the CRM.</p>

      <h2>How we use it</h2>
      <p>We use homeowner information so the roofing company can respond to the inspection request: see the lead, add notes, set a status, and keep a follow-up task. The CRM can score a lead to suggest a priority. If email is configured, we send the office an email about the new lead. We use pilot requests only to answer the company that asked for a pilot.</p>
      <p>We do not sell homeowner information.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>The roofing company that owns the form.</strong> Staff who can sign in to that company’s CRM can see its leads, photos, notes, and tasks.</li>
        <li><strong>The email provider.</strong> This app sends office alerts through Resend when that service is configured. The alert includes the lead’s name, phone, email, address, and what they asked for.</li>
        <li><strong>A text-message provider, if texts are turned on later.</strong> SMS alerts are part of the $99 plan and are not switched on in this version. If they are turned on, the phone number and the message are shared with the company that sends the texts.</li>
        <li><strong>The host.</strong> The website and the database are stored with the company that hosts this app. Sign-in sessions for staff are stored in that same database.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect someone from harm.</p>

      <h2>How long we keep it</h2>
      <p>A lead, its photos, notes, and tasks stay in the roofing company’s CRM until someone there deletes the lead, or until that company asks ${escapeHtml(LEGAL.vendorName)} to delete the account. Deleting a lead deletes its photos, notes, and tasks. We do not run an automatic purge after a set number of days. Pilot requests stay so we can reply and keep a record of who asked.</p>
      <p>The calls-and-texts record (the yes or no, the wording, the version, the time, and the IP address) stays with the lead.</p>

      <h2>Deletion and access requests</h2>
      <p>Email <a href="mailto:${email}">${email}</a> to ask for a copy of a homeowner request or a pilot request, or to ask us to delete it. Please include the name and the address or email on the request so we can find it. The roofing company can also delete a lead from its own CRM. We may keep a record of the request itself if we need it for a legal claim or a security incident.</p>

      <h2>Cookies and sessions</h2>
      <p>The inspection form, this policy, and the terms do not require an account. Staff sign-in uses a cookie named <code>roof.sid</code>. It keeps the office signed in, lasts 8 hours, is marked HttpOnly, and uses SameSite=Lax. On a production site it is only sent over HTTPS. We use it to remember that a staff member signed in. We do not use it for advertising, and we do not set advertising cookies.</p>
      <p>The host may keep ordinary connection logs, which can include an IP address and the page that was requested.</p>

      <h2>Children</h2>
      <p>The form is for adults asking about a property. We do not knowingly collect information from children.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we will update the date at the top. For a pilot, we will also tell the roofing company when the change is material.</p>

      <h2>Contact</h2>
      <p>Privacy questions and deletion requests: <a href="mailto:${email}">${email}</a>. Other questions: <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a>.</p>
    </main>
    ${publicFooter()}`;
    return layout({ title: `Privacy Policy | ${LEGAL.productName}`, body });
  }

  function termsPage() {
    const email = escapeHtml(LEGAL.contactEmail);
    const consent = smsConsentHtml(COMPANY_NAME);
    const body = `
    ${LAWYER_TODO}
    ${marketingHeader()}
    <main class="wrap legal-doc">
      <p class="eyebrow">Terms of Service</p>
      <h1>Terms of Service</h1>
      <p class="muted">Last updated ${escapeHtml(LEGAL.updated)}. These terms cover two uses of this website: a roofing company using ${escapeHtml(LEGAL.productName)}, and a homeowner using the inspection form.</p>

      <h2>The product</h2>
      <p>${escapeHtml(LEGAL.vendorName)} provides ${escapeHtml(LEGAL.productName)}, a lead form and a small CRM for roofing companies. We are about to run free pilots. The software stores inspection requests and helps the office follow up. It does not do the roofing work.</p>

      <h2>Homeowners using the form</h2>
      <p>Sending the form asks the roofing company named on the form to contact you about an inspection. It is a request, not a contract to repair or replace a roof, and not a promise that someone will arrive at a certain time. Please send accurate information about the property. Do not upload photos you do not have a right to share.</p>
      <p>You choose a call, a text, or email. If you choose a text, you must check the consent box. The box says: ${consent}</p>
      <p>That agreement is not a condition of buying roofing work. You can ask for an inspection by email instead. Message and data rates may apply to texts. Reply STOP to opt out of texts. See the <a href="/privacy">Privacy Policy</a> for what we collect and how to ask for deletion.</p>

      <h2>Roofing companies using the CRM</h2>
      <p>You are responsible for the leads you collect, including having a lawful reason to contact those people. You will not use the form or the CRM to break the law, to send spam, to harass anyone, or to upload information you have no right to share. You will not try to break into the product or disrupt it. We may suspend a pilot or a subscription that is used this way.</p>
      <p>You will not pretend sample or fictional leads are real customers.</p>

      <h2>Pilots, trial, and price</h2>
      <p>Free pilots come first. A pilot is arranged with us and is not billed. Nothing on this website collects a credit card.</p>
      <p>After a pilot, paid plans are month to month and start with a 14-day free trial:</p>
      <ul>
        <li><strong>Starter, $49 a month.</strong> Up to 2 users. Inspection form, dashboard, lead list, follow-up tasks, email alerts, and CSV import and export.</li>
        <li><strong>Crew, $99 a month.</strong> Up to 5 users. Everything in Starter, plus SMS alerts and an estimate PDF.</li>
      </ul>
      <p>SMS alerts and estimate PDFs are part of the Crew plan and are not switched on in this version. This version also uses one shared staff login, not a separate password for each person. We will not bill you for separate seats this version cannot keep apart. We will tell you before the first charge.</p>
      <p>If you cancel during the 14-day trial, you are not billed. After the trial, the plan renews each month until you cancel. Cancel anytime by emailing <a href="mailto:${email}">${email}</a>. We stop the next renewal. We do not promise a refund for a month that has already started.</p>

      <h2>Acceptable use</h2>
      <p>Do not misuse the site. That includes sending unlawful texts or calls, uploading malware, probing the service for a way in, or using someone else’s information without a right to do so. Homeowners should not use the form for an emergency that needs the fire department or an ambulance. Get off a roof that is unsafe, and call local emergency services when someone is in danger.</p>

      <h2>Roofing work is between the homeowner and the roofer</h2>
      <p>${escapeHtml(LEGAL.vendorName)} provides software. A repair, replacement, or inspection is a job between the homeowner and the roofing company. We do not promise a response time, a price for roof work, or that an on-screen estimate is a contract. An estimate PDF, when that feature is on, is a document the roofing company can give a customer. It is not a bid from ${escapeHtml(LEGAL.vendorName)}.</p>

      <h2>The service can change</h2>
      <p>Pilots are an early version. Features can change, and the site can be unavailable while it is hosted on a free plan that sleeps when idle. We will not invent results or hide a lead that was saved. If we cannot save a request, the form says so.</p>

      <h2>Contact</h2>
      <p>Questions about these terms, billing, or cancellation: <a href="mailto:${email}">${email}</a>. Privacy and deletion requests: <a href="mailto:${escapeHtml(LEGAL.privacyEmail)}">${escapeHtml(LEGAL.privacyEmail)}</a>.</p>
    </main>
    ${publicFooter()}`;
    return layout({ title: `Terms of Service | ${LEGAL.productName}`, body });
  }

  return { landingPage, privacyPage, termsPage };
};
