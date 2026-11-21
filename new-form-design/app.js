(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $("#lead-form");
  const steps = $$(".step", form);
  const TOTAL = 4;
  const TIME = ["About 60 seconds", "About 45 seconds left", "About 30 seconds left", "About 15 seconds left"];
  let step = 1;
  const touched = new Set();

  /* ---------- states ---------- */
  const STATES = [["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]];
  const stateSel = $("#state");
  STATES.forEach(([v, n]) => stateSel.add(new Option(n, v)));

  /* ---------- helpers ---------- */
  const needsPhone = () => (form.querySelector('input[name="preferred_contact"]:checked') || {}).value !== "Email";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const radio = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || "";
  const digits = s => (s || "").replace(/\D/g, "");
  const announce = t => { const a = $("#announcer"); a.textContent = ""; setTimeout(() => (a.textContent = t), 30); };
  function setMsg(input, msgEl, text) {
    const wrap = input.closest(".field");
    msgEl.textContent = text || "";
    input.setAttribute("aria-invalid", text ? "true" : "false");
    if (wrap) { wrap.classList.toggle("is-invalid", !!text); wrap.classList.toggle("is-valid", !text && input.value.trim() !== ""); }
  }
  function setGroup(groupEl, msgEl, text) {
    msgEl.textContent = text || "";
    groupEl.classList.toggle("invalid", !!text);
  }

  /* ---------- validators (return error text or "") ---------- */
  const V = {
    service_needed: () => radio("service_needed") ? "" : "Choose what you need help with.",
    address: () => !$("#street").value.trim() || !$("#city").value.trim() || !$("#state").value || !/^\d{5}$/.test(digits($("#zip").value)) ? "Enter a valid street, city, state and 5 digit ZIP code." : "",
    street: () => $("#street").value.trim().length >= 4 ? "" : "Enter the street and house number.",
    city: () => $("#city").value.trim() ? "" : "Enter the city.",
    state: () => $("#state").value ? "" : "Choose a state.",
    zip: () => /^\d{5}$/.test(digits($("#zip").value)) ? "" : "Enter a 5 digit ZIP code.",
    roof_type: () => radio("roof_type") ? "" : "Choose a roof type, or pick Not sure.",
    urgency: () => radio("urgency") ? "" : "Choose when you need us.",
    phone: () => { const d = digits($("#phone").value); if (!d) return needsPhone() ? (radio("preferred_contact") === "Text" ? "Enter a mobile number so we can text you." : "Enter a phone number so we can call you.") : ""; return d.length === 10 || (d.length === 11 && d[0] === "1") ? "" : "Enter a 10 digit phone number, for example (555) 123 4567."; },
    full_name: () => $("#full_name").value.trim().length >= 2 ? "" : "Enter your name.",
    email: () => { const v = $("#email").value.trim(); if (!v) return needsPhone() ? "" : "Enter your email so we can reply."; return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Check the email, it should look like name@example.com."; },
    sms_consent: () => radio("preferred_contact") === "Text" && !$("#sms_consent").checked ? "Check the box to agree to calls and texts about this request." : ""
  };
  const FIELD = {
    phone: ["#phone", "#phone-msg"], full_name: ["#full_name", "#name-msg"], email: ["#email", "#email-msg"],
    street: ["#street", "#street-msg"], city: ["#city", "#city-msg"], state: ["#state", "#state-msg"], zip: ["#zip", "#zip-msg"],
    address: ["#address", "#address-msg"]
  };
  const GROUP = { service_needed: ["#f-service", "#service-msg"], roof_type: ["#f-roof", "#roof-msg"], urgency: ["#f-urgency", "#urgency-msg"] };
  const LABEL = { service_needed: "What you need", address: "Property address", street: "Street address", city: "City", state: "State", zip: "ZIP", roof_type: "Roof type", urgency: "Timing", phone: "Phone", full_name: "Full name", email: "Email", sms_consent: "Calls and texts" };

  function check(key, show = true) {
    if (key === "sms_consent") {
      const err = V.sms_consent();
      if (show) {
        const msg = $("#consent-msg");
        const box = $("#sms-consent-field");
        if (msg) msg.textContent = err || "";
        if (box) box.classList.toggle("is-invalid", !!err);
      }
      return err;
    }
    const err = V[key]();
    if (!show) return err;
    if (FIELD[key]) setMsg($(FIELD[key][0]), $(FIELD[key][1]), err);
    if (GROUP[key]) setGroup($(GROUP[key][0]), $(GROUP[key][1]), err);
    return err;
  }
  function keysFor(n) {
    if (n === 1) return ["service_needed"];
    if (n === 2) return ["street", "city", "state", "zip", "roof_type"];
    if (n === 3) return ["urgency"];
    const keys = needsPhone() ? ["phone", "full_name", "email"] : ["email", "full_name", "phone"];
    if (radio("preferred_contact") === "Text") keys.push("sms_consent");
    return keys;
  }

  /* ---------- live validation as people type ---------- */
  ["phone", "full_name", "email", "street", "city", "state", "zip"].forEach(k => {
    const el = $(FIELD[k][0]);
    el.addEventListener("blur", () => { if (el.value.trim()) touched.add(k); if (touched.has(k)) check(k); });
    el.addEventListener("input", () => {
      if (touched.has(k)) check(k);
      else if (!V[k]()) { el.closest(".field").classList.add("is-valid"); } /* reward valid input early */
      else el.closest(".field").classList.remove("is-valid");
      refreshSummary();
    });
    el.addEventListener("change", () => { if (touched.has(k)) check(k); });
  });
  ["service_needed", "roof_type", "urgency"].forEach(k => {
    $$(`input[name="${k}"]`).forEach(r => r.addEventListener("change", () => { check(k); refreshSummary(); }));
  });

  /* phone mask: (555) 123 4567, spaces only */
  $("#phone").addEventListener("input", e => {
    let d = digits(e.target.value); if (d.length === 11 && d[0] === "1") d = d.slice(1); d = d.slice(0, 10);
    let out = d;
    if (d.length > 6) out = `(${d.slice(0,3)}) ${d.slice(3,6)} ${d.slice(6)}`;
    else if (d.length > 3) out = `(${d.slice(0,3)}) ${d.slice(3)}`;
    else if (d.length > 0) out = `(${d}`;
    e.target.value = out;
  }, true);

  /* ---------- step 4: contact method decides what is required ---------- */
  function applyMethod() {
    const m = radio("preferred_contact"), phoneReq = m !== "Email";
    $("#phone-label").textContent = m === "Text" ? "Mobile number" : "Phone number";
    $("#phone-opt").hidden = phoneReq; $("#email-opt").hidden = !phoneReq;
    $("#phone").required = phoneReq; $("#email").required = !phoneReq;
    $("#phone").setAttribute("aria-required", phoneReq); $("#email").setAttribute("aria-required", !phoneReq);
    const box = $("#contact-fields");
    if (phoneReq) box.append($("#phone-field"), $("#name-field"), $("#email-field"));
    else box.append($("#email-field"), $("#name-field"), $("#phone-field"));
    ["phone", "email"].forEach(k => { if (touched.has(k) || $(FIELD[k][0]).value) check(k); else setMsg($(FIELD[k][0]), $(FIELD[k][1]), ""); });
    const showConsent = m === "Phone" || m === "Text";
    const consent = $("#sms-consent-field");
    const consentBox = $("#sms_consent");
    if (consent && consentBox) {
      consent.hidden = !showConsent;
      consentBox.disabled = !showConsent;
      if (!showConsent) {
        consentBox.checked = false;
        consent.classList.remove("is-invalid");
        const msg = $("#consent-msg");
        if (msg) msg.textContent = "";
      } else if (touched.has("sms_consent")) check("sms_consent");
    }
    refreshSummary();
  }
  $$('input[name="preferred_contact"]').forEach(r => r.addEventListener("change", () => { applyMethod(); announce(radio("preferred_contact") === "Email" ? "Email is now required. Phone is optional." : radio("preferred_contact") === "Text" ? "A mobile number is required. Agree to calls and texts before we can text you." : "Phone is required. Email is optional."); }));
  const consentBox = $("#sms_consent");
  if (consentBox) consentBox.addEventListener("change", () => { touched.add("sms_consent"); check("sms_consent"); refreshSummary(); });

  /* ---------- auto advance: pointer tap or Enter only, never arrow keys ---------- */
  let viaPointer = false, advTimer = null;
  form.addEventListener("pointerdown", e => { if (e.target.closest(".tile")) viaPointer = true; });
  form.addEventListener("keydown", e => { if (e.key !== "Enter") viaPointer = false; }, true);
  function typing() { const a = document.activeElement; return a && (a.matches("input[type=text],input[type=tel],input[type=email],textarea")); }
  function canAutoAdvance() {
    if (step === 1) return radio("service_needed") && !radio("service_needed").startsWith("Leak");
    if (step === 2) return radio("roof_type") && !V.address() && !typing() && $("#manual-addr").hidden;
    return false; /* step 3 has optional note and photos after the choice; step 4 needs typing */
  }
  function scheduleAdvance(tile) {
    clearTimeout(advTimer);
    if (!canAutoAdvance()) return;
    if (tile && !reduced()) { tile.classList.remove("picked"); void tile.offsetWidth; tile.classList.add("picked"); }
    const at = step;
    advTimer = setTimeout(() => { if (step === at && canAutoAdvance()) $("#next-btn").click(); }, 250);
  }
  ["service_needed", "roof_type"].forEach(k => $$(`input[name="${k}"]`).forEach(r => {
    r.addEventListener("change", () => { if (viaPointer) scheduleAdvance(r.closest(".tile")); viaPointer = false; });
    r.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true }));
        if (r.value.startsWith("Leak")) return; scheduleAdvance(r.closest(".tile")); }
    });
  }));

  /* ---------- step 1: leak state ---------- */
  $$('input[name="service_needed"]').forEach(r => r.addEventListener("change", () => {
    const leak = radio("service_needed").startsWith("Leak");
    $("#urgent-panel").hidden = !leak;
    $("#next-label").textContent = leak && step === 1 ? "Continue online" : "Next";
    if (leak) { const u = form.querySelector('input[name="urgency"][value^="Emergency"]'); u.checked = true; }
    if (leak) { announce("Active leak selected. You can call us now or continue online.");
      setTimeout(() => $("#urgent-panel").scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }), 60); }
  }));

  /* Manual address entry: no fabricated sample address suggestions. */
  const addr = $("#address"), list = $("#addr-list");
  $("#manual-addr").hidden = false; $("#addr-field").hidden = true; $("#manual-toggle").hidden = true; addr.disabled = true;

  /* ---------- step 3: counter + photos ---------- */
  const desc = $("#issue_description");
  desc.addEventListener("input", () => ($("#desc-count").textContent = `${desc.value.length} of 2000 characters`));
  const photos = $("#photos"), thumbs = $("#thumbs"); let files = [];
  photos.addEventListener("change", () => {
    const incoming = [...photos.files];
    if (incoming.some(f => !f.type.startsWith("image/") || f.size > 5 * 1024 * 1024)) announce("Use image files no larger than 5 megabytes each.");
    files = files.concat(incoming.filter(f => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024)).slice(0, 5);
    renderThumbs();
  });
  function renderThumbs() {
    thumbs.innerHTML = "";
    files.forEach((f, i) => {
      const li = document.createElement("li"); const img = document.createElement("img"); img.alt = `Photo ${i + 1}: ${f.name}`; img.src = URL.createObjectURL(f);
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", `Remove photo ${i + 1}`); b.textContent = "×";
      b.onclick = () => { files.splice(i, 1); renderThumbs(); };
      li.append(img, b); thumbs.append(li);
    });
    const dt = new DataTransfer(); files.forEach(f => dt.items.add(f)); photos.files = dt.files;
  }

  /* ---------- error summary ---------- */
  let summaryOn = false;
  function refreshSummary() {
    if (!summaryOn) return;
    const errs = keysFor(step).map(k => [k, V[k]()]).filter(x => x[1]);
    if (!errs.length) { $("#err-summary").hidden = true; summaryOn = false; return; }
    $("#err-list").innerHTML = errs.map(([k, m]) => `<li><a href="#" data-k="${k}">${LABEL[k]}</a></li>`).join("");
  }
  $("#err-list").addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a) return; e.preventDefault();
    const k = a.dataset.k; const el = k === "sms_consent" ? $("#sms_consent") : FIELD[k] ? $(FIELD[k][0]) : $(`${GROUP[k][0]} input`); if (el) el.focus();
  });

  /* ---------- navigation ---------- */
  function go(n) {
    step = n;
    clearTimeout(advTimer);
    steps.forEach(s => { s.hidden = +s.dataset.step !== n; s.classList.remove("enter"); });
    if (!reduced()) { void steps[n - 1].offsetWidth; steps[n - 1].classList.add("enter"); }
    $$(".seg").forEach((s, i) => s.classList.toggle("on", i < n));
    $(".progress").setAttribute("aria-valuenow", n); $(".progress").setAttribute("aria-valuetext", `Step ${n} of ${TOTAL}`);
    $("#step-count").textContent = `Step ${n} of ${TOTAL}`;
    $("#time-left").lastChild.textContent = TIME[n - 1];
    $("#back-btn").hidden = n === 1;
    const leak = radio("service_needed").startsWith("Leak");
    $("#next-label").textContent = n === TOTAL ? "Send my request" : (n === 1 && leak ? "Continue online" : "Next");
    $("#err-summary").hidden = true; summaryOn = false;
    const t = steps[n - 1].querySelector(".step-title");
    if (window.matchMedia("(max-width:640px)").matches) $("#lead-card").scrollIntoView({ block: "start", behavior: "auto" });
    t.focus({ preventScroll: true });
    announce(`Step ${n} of ${TOTAL}. ${t.textContent}`);
  }
  function validateStep() {
    const keys = keysFor(step); keys.forEach(k => touched.add(k));
    const errs = keys.filter(k => check(k));
    if (!errs.length) return true;
    summaryOn = true; $("#err-summary").hidden = false; refreshSummary();
    if (errs.length > 1) $("#err-summary").focus();
    else { const k = errs[0]; (FIELD[k] ? $(FIELD[k][0]) : $(`${GROUP[k][0]} input`)).focus(); }
    announce(`${errs.length} ${errs.length > 1 ? "fields need" : "field needs"} attention.`);
    return false;
  }
  $("#next-btn").addEventListener("click", () => {
    if (!validateStep()) return;
    if (step < TOTAL) go(step + 1); else submit();
  });
  $("#back-btn").addEventListener("click", () => go(step - 1));
  form.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "file" && e.target.type !== "checkbox" && e.target.id !== "address") { e.preventDefault(); $("#next-btn").click(); } });
  document.body.classList.add("form-active");
  form.addEventListener("submit", e => { e.preventDefault(); if (step === TOTAL) { if (validateStep()) submit(); } else $("#next-btn").click(); });

  /* Submit to the real backend. Never display success until the server confirms. */
  async function submit() {
    const button = $("#next-btn"), label = $("#next-label"), oldLabel = label.textContent;
    button.disabled = true; label.textContent = "Sending…";
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const message = result.message || "We could not save this request. Please check your details and try again.";
        $("#err-summary").hidden = false; $("#err-list").textContent = message; $("#err-summary").focus(); announce(message); return;
      }
      const name = $("#full_name").value.trim().split(/\s+/)[0] || "there";
      $("#s-name").textContent = name;
      const urg = form.querySelector('input[name="urgency"]:checked').nextElementSibling.textContent;
      const svc = form.querySelector('input[name="service_needed"]:checked').closest("label").querySelector("strong").textContent;
      const roof = form.querySelector('input[name="roof_type"]:checked').closest("label").querySelector("strong").textContent;
      const where = $("#street").value + ", " + $("#city").value + ", " + $("#state").value + " " + $("#zip").value;
      const rows = [["Service",svc],["Address",where],["Roof",roof],["Timing",urg]];
      if (files.length) rows.push(["Photos",files.length + " uploaded"]);
      const summary = $("#s-summary"); summary.replaceChildren();
      rows.forEach(([k,v]) => { const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=k;dd.textContent=v;summary.append(dt,dd);});
      $("#s-ref").textContent = result.reference || ("RL-" + result.id);
      $("#s-urgent").hidden = !radio("urgency").startsWith("Emergency");
      form.hidden = true; $("#progress-wrap").hidden = true; $("#success").hidden = false; document.body.classList.add("done");
      $("#lead-card").scrollIntoView({block:"start"}); $("#success").focus({preventScroll:true}); announce("Request saved.");
    } catch (_) {
      const message = "Network error. Your request was not confirmed as saved. Please try again.";
      $("#err-summary").hidden = false; $("#err-list").textContent = message; $("#err-summary").focus(); announce(message);
    } finally { button.disabled = false; label.textContent = oldLabel; }
  }
  $("#restart").addEventListener("click", () => {
    form.reset(); files = []; renderThumbs(); touched.clear();
    $$(".is-valid,.is-invalid").forEach(e => e.classList.remove("is-valid", "is-invalid")); $$(".field-msg").forEach(m => (m.textContent = ""));
    $("#urgent-panel").hidden = true; $("#manual-addr").hidden = false; $("#addr-field").hidden = true; $("#manual-toggle").hidden = true; addr.disabled = true; applyMethod();
    form.hidden = false; $("#progress-wrap").hidden = false; $("#success").hidden = true; document.body.classList.remove("done"); go(1);
  });

  applyMethod();
})();
