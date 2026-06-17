import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import {
  Armchair,
  Banknote,
  Briefcase,
  CalendarClock,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Gauge,
  MapPin,
  Moon,
  Plane,
  Plus,
  Printer,
  Route,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";

const api = {
  async get(path) {
    const response = await fetch(path);
    return parse(response);
  },
  async post(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return parse(response);
  },
  async put(path, body) {
    const response = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return parse(response);
  }
};

const vehicleStyles = {
  saloon: { tone: "Graphite", image: "linear-gradient(135deg, #263240, #5f6e7a)" },
  executive: { tone: "Pearl", image: "linear-gradient(135deg, #eef2f3, #9ba7ae)" },
  "eight-seater": { tone: "Onyx", image: "linear-gradient(135deg, #15191f, #46515c)" }
};

function App() {
  const [view, setView] = useState("book");
  const [config, setConfig] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [invoiceId, setInvoiceId] = useState(null);

  async function refresh() {
    const [nextConfig, nextDashboard, nextBookings] = await Promise.all([
      api.get("/api/config"),
      api.get("/api/dashboard"),
      api.get("/api/bookings")
    ]);
    setConfig(nextConfig);
    setDashboard(nextDashboard);
    setBookings(nextBookings);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!config || !dashboard) return <main className="loading">Preparing your transfer desk...</main>;

  return (
    <main className="app-shell">
      <Header view={view} setView={setView} company={config.company} />
      {view === "book" && <BookingExperience config={config} onBooked={refresh} onInvoice={setInvoiceId} />}
      {view === "admin" && <AdminPanel config={config} dashboard={dashboard} onSaved={refresh} />}
      {view === "bookings" && <BookingManagement bookings={bookings} currency={config.company.currency} onInvoice={setInvoiceId} />}
      {invoiceId && <InvoiceModal bookingId={invoiceId} onClose={() => setInvoiceId(null)} />}
    </main>
  );
}

function Header({ view, setView, company }) {
  return (
    <header className="topbar">
      <button className="brand-button" type="button" onClick={() => setView("book")}>
        <span className="brand-mark"><Plane size={18} /></span>
        <span>
          <strong>{company.name}</strong>
          <small>Airport chauffeur booking</small>
        </span>
      </button>
      <nav className="nav-tabs" aria-label="Main">
        <button className={view === "book" ? "active" : ""} onClick={() => setView("book")}><MapPin size={17} /> Book</button>
        <button className={view === "bookings" ? "active" : ""} onClick={() => setView("bookings")}><FileText size={17} /> Jobs</button>
        <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Settings size={17} /> Admin</button>
      </nav>
    </header>
  );
}

function BookingExperience({ config, onBooked, onInvoice }) {
  const firstVehicle = config.vehicles.find((vehicle) => vehicle.active)?.id || "";
  const [form, setForm] = useState({
    pickup: "",
    dropoff: "",
    extraStops: [],
    vehicleId: firstVehicle,
    dateTime: "",
    manualDistanceMiles: "",
    passengers: 1,
    luggage: 1,
    flightNumber: "",
    notes: "",
    serviceOptions: { meetAndGreet: true, returnTrip: false, childSeats: 0 },
    customer: { name: "", email: "", phone: "" }
  });
  const [quote, setQuote] = useState(null);
  const [message, setMessage] = useState("");
  const selectedVehicle = config.vehicles.find((vehicle) => vehicle.id === form.vehicleId);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setQuote(null);
  }

  function updateOption(key, value) {
    setForm((current) => ({
      ...current,
      serviceOptions: { ...current.serviceOptions, [key]: value }
    }));
    setQuote(null);
  }

  async function getQuote(event) {
    event.preventDefault();
    setMessage("");
    setQuote(await api.post("/api/quote", form));
  }

  async function book() {
    const booking = await api.post("/api/bookings", { ...form, distanceMiles: quote.distanceMiles });
    setMessage(`Confirmed ${booking.id}`);
    await onBooked();
    onInvoice(booking.id);
  }

  return (
    <>
      <section className="hero-stage">
        <RouteScene quote={quote} vehicle={selectedVehicle} />
        <div className="hero-copy">
          <p className="eyebrow">Live fixed-fare chauffeur quotes</p>
          <h1>Book airport transfers with slab pricing, stops and premium extras.</h1>
          <p className="hero-lead">A complete booking desk for chauffeur teams: customers get a clear fare, dispatch sees every job, and admins can change vehicles, mileage slabs and extras without touching code.</p>
          <div className="hero-stats">
            <span><ShieldCheck size={16} /> Fixed confirmed fare</span>
            <span><Route size={16} /> Multi-stop routes</span>
            <span><Moon size={16} /> Night pricing</span>
          </div>
        </div>
      </section>

      <GuideSection />

      <section className="booking-grid">
        <form className="booking-card primary-card" onSubmit={getQuote}>
          <StepTitle icon={<MapPin size={19} />} title="Journey" label="Step 1" />
          <div className="field-stack">
            <Field label="Pickup" value={form.pickup} onChange={(value) => update("pickup", value)} placeholder="Heathrow Terminal 5" required />
            <Field label="Drop-off" value={form.dropoff} onChange={(value) => update("dropoff", value)} placeholder="Mayfair, London" required />
            <ExtraStops stops={form.extraStops} onChange={(extraStops) => update("extraStops", extraStops)} />
          </div>

          <StepTitle icon={<Car size={19} />} title="Vehicle" label="Step 2" />
          <VehiclePicker vehicles={config.vehicles} selected={form.vehicleId} onSelect={(vehicleId) => update("vehicleId", vehicleId)} />

          <StepTitle icon={<CalendarClock size={19} />} title="Details" label="Step 3" />
          <div className="compact-grid">
            <label>Date and time<input type="datetime-local" value={form.dateTime} onChange={(event) => update("dateTime", event.target.value)} required /></label>
            <Field label="Distance miles" type="number" step="0.1" value={form.manualDistanceMiles} onChange={(value) => update("manualDistanceMiles", value)} placeholder="Auto with Google key" />
            <Field label="Flight number" value={form.flightNumber} onChange={(value) => update("flightNumber", value)} placeholder="BA117" />
            <Field label="Passengers" type="number" min="1" value={form.passengers} onChange={(value) => update("passengers", Number(value))} />
            <Field label="Luggage" type="number" min="0" value={form.luggage} onChange={(value) => update("luggage", Number(value))} />
            <Field label="Child seats" type="number" min="0" value={form.serviceOptions.childSeats} onChange={(value) => updateOption("childSeats", Number(value))} />
          </div>

          <div className="option-row">
            <Toggle checked={form.serviceOptions.meetAndGreet} onChange={(checked) => updateOption("meetAndGreet", checked)} icon={<Sparkles size={17} />} label="Meet and greet" />
            <Toggle checked={form.serviceOptions.returnTrip} onChange={(checked) => updateOption("returnTrip", checked)} icon={<ChevronRight size={17} />} label="Return trip" />
          </div>

          <StepTitle icon={<Users size={19} />} title="Passenger" label="Step 4" />
          <div className="compact-grid customer-grid">
            <Field label="Name" value={form.customer.name} onChange={(value) => update("customer", { ...form.customer, name: value })} required />
            <Field label="Email" type="email" value={form.customer.email} onChange={(value) => update("customer", { ...form.customer, email: value })} required />
            <Field label="Phone" value={form.customer.phone} onChange={(value) => update("customer", { ...form.customer, phone: value })} required />
          </div>
          <label>Driver notes<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Name board, pickup instructions, mobility needs..." /></label>
          <button className="action-button quote-action" type="submit"><Banknote size={18} /> Calculate live quote</button>
          {message && <p className="success-pill"><Check size={16} /> {message}</p>}
        </form>

        <aside className="quote-dock">
          <QuotePanel quote={quote} currency={config.company.currency} vehicle={selectedVehicle} onBook={book} />
          <FeatureRail settings={config.settings} />
        </aside>
      </section>
    </>
  );
}

function GuideSection() {
  return (
    <section className="guide-section">
      <div className="guide-intro">
        <p className="eyebrow">New here</p>
        <h2>Four clear steps from route to confirmed chauffeur booking.</h2>
        <p>Use this as a customer-facing quote form or as an internal dispatcher tool. The fare is calculated from your vehicle pricing matrix, then stored with the booking and invoice so later price changes never rewrite old jobs.</p>
      </div>
      <div className="guide-grid">
        <article>
          <span><MapPin size={20} /></span>
          <h3>Enter the journey</h3>
          <p>Add pickup, drop-off and optional extra stops. Google Maps distance can be enabled with an API key; manual miles stay available for dispatch.</p>
        </article>
        <article>
          <span><Car size={20} /></span>
          <h3>Choose the right vehicle</h3>
          <p>Saloon, executive, 8-seater or VIP vehicles each use their own mileage-slab prices, capacity and luggage rules.</p>
        </article>
        <article>
          <span><WalletCards size={20} /></span>
          <h3>Review the fixed fare</h3>
          <p>The quote shows base fare, stops, meet-and-greet, child seats, night surcharge and return-trip pricing before confirmation.</p>
        </article>
        <article>
          <span><ClipboardCheck size={20} /></span>
          <h3>Manage the job</h3>
          <p>Confirmed bookings appear in the jobs area with passenger details, route, flight number, invoice and searchable history.</p>
        </article>
      </div>
    </section>
  );
}

function RouteScene({ quote, vehicle }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0e171d, 7, 18);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 4.4, 8.8);
    camera.lookAt(0, 0.25, -2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(9.4, 22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x22292e, metalness: 0.16, roughness: 0.54 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -3;
    scene.add(road);

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x11181d, metalness: 0.2, roughness: 0.7 });
    for (const x of [-5.05, 5.05]) {
      const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 22, 1, 1), shoulderMaterial);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(x, 0.012, -3);
      scene.add(shoulder);
    }

    const laneMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8eef2,
      emissive: 0x20282d,
      emissiveIntensity: 0.25,
      metalness: 0,
      roughness: 0.45
    });
    for (const x of [-1.55, 1.55]) {
      for (let z = -13; z <= 7; z += 2.1) {
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.9), laneMaterial);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(x, 0.026, z);
        scene.add(lane);
      }
    }

    const vehicles = [
      { lane: -2.55, z: 6.2, speed: 0.018, scale: 1.2, color: 0xf1eee7, kind: "van" },
      { lane: 0, z: 1.6, speed: 0.023, scale: 1.02, color: 0x111820, kind: "suv" },
      { lane: 2.55, z: -3.8, speed: 0.017, scale: 1.12, color: 0xd9dee1, kind: "saloon" },
      { lane: -1.15, z: -9.2, speed: 0.026, scale: 0.92, color: 0x27343d, kind: "suv" },
      { lane: 1.25, z: -13.6, speed: 0.02, scale: 1.28, color: 0xf3f0e8, kind: "van" }
    ].map((vehicleConfig) => {
      const group = createVehicle(vehicleConfig);
      group.position.set(vehicleConfig.lane, 0, vehicleConfig.z);
      scene.add(group);
      return { ...vehicleConfig, group };
    });

    const terminal = new THREE.Group();
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0x34434c, metalness: 0.25, roughness: 0.5 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xf7c966, emissive: 0xa05d05, emissiveIntensity: 0.35 });
    const terminalBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.3), terminalMat);
    terminalBody.position.set(-2.7, 0.45, -5.7);
    terminal.add(terminalBody);
    for (const x of [-3.4, -2.9, -2.4, -1.9]) {
      const terminalWindow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.035), windowMat);
      terminalWindow.position.set(x, 0.5, -5.52);
      terminal.add(terminalWindow);
    }
    scene.add(terminal);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x29323a, 2.45));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(2, 8, 4);
    scene.add(key);
    const roadGlow = new THREE.PointLight(0xffe7ad, 1.2, 10);
    roadGlow.position.set(0, 1.2, 5.5);
    scene.add(roadGlow);

    let frame;
    function resize() {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    }
    function animate(time) {
      for (const moving of vehicles) {
        moving.group.position.z += moving.speed * 16;
        if (moving.group.position.z > 8.8) {
          moving.group.position.z = -14.2 - Math.random() * 3.5;
        }
        moving.group.position.y = Math.sin(time * 0.003 + moving.lane) * 0.012;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }
    resize();
    animate(0);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="route-scene" ref={mountRef}>
      <div className="scene-chip top"><Plane size={16} /> Airport pickup</div>
      <div className="scene-chip bottom"><Car size={16} /> {vehicle?.name || "Vehicle"} {quote ? `- ${quote.distanceMiles} mi` : ""}</div>
    </div>
  );
}

function createVehicle({ color, kind, scale }) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.82, roughness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c25, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.82 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8d0d2, metalness: 0.95, roughness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x070b0e, metalness: 0.28, roughness: 0.5 });
  const light = new THREE.MeshStandardMaterial({ color: 0xfff1bf, emissive: 0xffcc69, emissiveIntensity: 1.5 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xff3157, emissive: 0xff183c, emissiveIntensity: 0.65 });

  const isVan = kind === "van";
  const isSuv = kind === "suv";
  const width = isVan ? 1.62 : isSuv ? 1.46 : 1.34;
  const length = isVan ? 3.05 : isSuv ? 2.62 : 2.38;
  const bodyHeight = isVan ? 0.68 : isSuv ? 0.5 : 0.36;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyHeight, length), paint);
  body.position.y = 0.46;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.78, isVan ? 0.58 : 0.44, isVan ? 1.55 : 1.08),
    glass
  );
  cabin.position.set(0, isVan ? 0.98 : 0.78, isVan ? -0.18 : -0.2);
  group.add(cabin);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, 0.16, isVan ? 0.52 : 0.76), paint);
  hood.position.set(0, isVan ? 0.84 : 0.58, length / 2 - (isVan ? 0.36 : 0.48));
  group.add(hood);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.08, isVan ? 1.45 : 0.9), paint);
  roof.position.set(0, isVan ? 1.31 : 1.04, isVan ? -0.18 : -0.22);
  group.add(roof);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.48, 0.14, 0.04), chrome);
  grille.position.set(0, 0.5, length / 2 + 0.025);
  group.add(grille);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.84, 0.1, 0.08), chrome);
  bumper.position.set(0, 0.32, length / 2 + 0.04);
  group.add(bumper);

  for (const x of [-width * 0.33, width * 0.33]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, 0.08, 0.04), light);
    headlight.position.set(x, 0.56, length / 2 + 0.06);
    group.add(headlight);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(width * 0.15, 0.08, 0.04), tail);
    tailLight.position.set(x, 0.55, -length / 2 - 0.035);
    group.add(tailLight);
  }

  for (const x of [-width * 0.57, width * 0.57]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), paint);
    mirror.position.set(x, isVan ? 0.96 : 0.76, length * 0.15);
    group.add(mirror);
  }

  for (const x of [-width * 0.43, width * 0.43]) {
    for (const z of [-length * 0.32, length * 0.32]) {
      const wheelGroup = new THREE.Group();
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 32), dark);
      wheel.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 24), chrome);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(wheel, rim);
      wheelGroup.position.set(x, 0.23, z);
      group.add(wheelGroup);
    }
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.scale.set(width * 0.72, length * 0.62, 1);
  group.add(shadow);

  const headlampGlow = new THREE.PointLight(0xffe5a8, isVan ? 1.4 : 1.1, 4);
  headlampGlow.position.set(0, 0.48, length / 2);
  group.add(headlampGlow);

  group.scale.setScalar(scale);
  return group;
}

function VehiclePicker({ vehicles, selected, onSelect }) {
  return (
    <div className="vehicle-strip">
      {vehicles.filter((vehicle) => vehicle.active).map((vehicle) => {
        const style = vehicleStyles[vehicle.id] || vehicleStyles.saloon;
        return (
          <button
            className={`vehicle-tile ${selected === vehicle.id ? "selected" : ""}`}
            type="button"
            key={vehicle.id}
            onClick={() => onSelect(vehicle.id)}
          >
            <span className="vehicle-art" style={{ background: style.image }}><Car size={34} /></span>
            <strong>{vehicle.name}</strong>
            <small><Users size={14} /> {vehicle.capacity} seats <Briefcase size={14} /> {vehicle.luggage} bags</small>
            <em>{style.tone}</em>
          </button>
        );
      })}
    </div>
  );
}

function QuotePanel({ quote, vehicle, currency, onBook }) {
  return (
    <div className="quote-panel glass-panel">
      <div className="quote-head">
        <span><Gauge size={18} /> Live fare</span>
        <strong>{quote ? money(quote.breakdown.total, quote.currency) : money(0, currency)}</strong>
      </div>
      {quote ? (
        <>
          <div className="fare-map">
            <span>Base</span><strong>{money(quote.breakdown.basePrice, quote.currency)}</strong>
            <span>Stops</span><strong>{money(quote.breakdown.extraStopTotal, quote.currency)}</strong>
            <span>Meet & greet</span><strong>{money(quote.breakdown.meetAndGreetTotal, quote.currency)}</strong>
            <span>Child seats</span><strong>{money(quote.breakdown.childSeatTotal, quote.currency)}</strong>
            <span>Night</span><strong>{money(quote.breakdown.nightSurcharge, quote.currency)}</strong>
            <span>Return</span><strong>{money(quote.breakdown.returnTripTotal, quote.currency)}</strong>
          </div>
          <div className="quote-route">
            <Route size={18} />
            <span>{quote.distanceMiles} miles, slab {quote.slab.minMiles}-{quote.slab.maxMiles}</span>
          </div>
          <button className="action-button" type="button" onClick={onBook}><CalendarClock size={18} /> Confirm booking</button>
        </>
      ) : (
        <div className="empty-quote">
          <Car size={30} />
          <p>Select your journey and vehicle to reveal an instant fixed fare.</p>
          <small>{vehicle?.name || "Fleet"} pricing comes directly from the admin matrix.</small>
        </div>
      )}
    </div>
  );
}

function FeatureRail({ settings }) {
  return (
    <div className="feature-rail">
      <article><Sparkles size={19} /><span>Meet & greet</span><strong>{money(settings.meetAndGreetAmount)}</strong></article>
      <article><Armchair size={19} /><span>Child seat</span><strong>{money(settings.childSeatAmount)}</strong></article>
      <article><Moon size={19} /><span>Night cover</span><strong>{settings.nightSurchargePercent}%</strong></article>
    </div>
  );
}

function ExtraStops({ stops, onChange }) {
  return (
    <div className="stops">
      <div className="row-title">
        <span>Extra drop-offs</span>
        <button type="button" className="icon-button" title="Add stop" onClick={() => onChange([...stops, ""])}><Plus size={18} /></button>
      </div>
      {stops.map((stop, index) => (
        <div className="stop-row" key={index}>
          <input value={stop} onChange={(event) => onChange(stops.map((item, i) => (i === index ? event.target.value : item)))} placeholder={`Stop ${index + 1}`} />
          <button type="button" className="icon-button danger" title="Remove stop" onClick={() => onChange(stops.filter((_, i) => i !== index))}><Trash2 size={18} /></button>
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ config, dashboard, onSaved }) {
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(config), [config]);

  function updateVehicle(vehicleId, patch) {
    setDraft((current) => ({ ...current, vehicles: current.vehicles.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, ...patch } : vehicle)) }));
  }

  function updatePrice(vehicleId, slabId, value) {
    setDraft((current) => ({
      ...current,
      vehicles: current.vehicles.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, prices: { ...vehicle.prices, [slabId]: Number(value) } } : vehicle)
    }));
  }

  function addVehicle() {
    const id = `vehicle-${Date.now()}`;
    setDraft((current) => ({
      ...current,
      vehicles: [...current.vehicles, { id, name: "VIP Class", capacity: 3, luggage: 2, active: true, prices: Object.fromEntries(current.slabs.map((slab) => [slab.id, 0])) }]
    }));
  }

  async function save() {
    await api.put("/api/config", draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    await onSaved();
  }

  return (
    <section className="admin-page">
      <div className="metrics">
        <Metric label="Bookings" value={dashboard.totalBookings} icon={<CalendarClock size={20} />} />
        <Metric label="Revenue" value={money(dashboard.totalRevenue, config.company.currency)} icon={<Banknote size={20} />} />
        <Metric label="Active fleet" value={dashboard.activeVehicles} icon={<Car size={20} />} />
      </div>
      <div className="admin-panel">
        <div className="panel-title">
          <Settings size={20} />
          <h2>Fleet pricing matrix</h2>
          <button className="secondary push" type="button" onClick={addVehicle}><Plus size={18} /> Vehicle</button>
          <button className="action-button small" type="button" onClick={save}><Save size={18} /> Save pricing</button>
        </div>
        {saved && <p className="success-pill"><Check size={16} /> Pricing saved</p>}
        <div className="matrix">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th><th>Seats</th><th>Bags</th><th>Live</th>
                {draft.slabs.map((slab) => <th key={slab.id}>{slab.minMiles}-{slab.maxMiles}</th>)}
              </tr>
            </thead>
            <tbody>
              {draft.vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><input value={vehicle.name} onChange={(event) => updateVehicle(vehicle.id, { name: event.target.value })} /></td>
                  <td><input type="number" value={vehicle.capacity} onChange={(event) => updateVehicle(vehicle.id, { capacity: Number(event.target.value) })} /></td>
                  <td><input type="number" value={vehicle.luggage} onChange={(event) => updateVehicle(vehicle.id, { luggage: Number(event.target.value) })} /></td>
                  <td><input type="checkbox" checked={vehicle.active} onChange={(event) => updateVehicle(vehicle.id, { active: event.target.checked })} /></td>
                  {draft.slabs.map((slab) => <td key={slab.id}><input type="number" min="0" value={vehicle.prices[slab.id] || 0} onChange={(event) => updatePrice(vehicle.id, slab.id, event.target.value)} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="settings-panel">
        <Field label="Meet & greet" type="number" value={draft.settings.meetAndGreetAmount} onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, meetAndGreetAmount: Number(value) } })} />
        <Field label="Child seat" type="number" value={draft.settings.childSeatAmount} onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, childSeatAmount: Number(value) } })} />
        <Field label="Extra stop fixed" type="number" value={draft.settings.extraStopFixedAmount} onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, extraStopFixedAmount: Number(value) } })} />
        <Field label="Return discount %" type="number" value={draft.settings.returnTripDiscountPercent} onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, returnTripDiscountPercent: Number(value) } })} />
        <Field label="Night surcharge %" type="number" value={draft.settings.nightSurchargePercent} onChange={(value) => setDraft({ ...draft, settings: { ...draft.settings, nightSurchargePercent: Number(value) } })} />
      </div>
    </section>
  );
}

function BookingManagement({ bookings, currency, onInvoice }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => bookings.filter((booking) => JSON.stringify(booking).toLowerCase().includes(query.toLowerCase())), [bookings, query]);
  return (
    <section className="jobs-page">
      <div className="jobs-header">
        <StepTitle icon={<FileText size={20} />} title="Booking management" label={`${bookings.length} jobs`} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search passenger, route, booking ID" />
      </div>
      <div className="booking-list">
        {filtered.map((booking) => (
          <article className="job-card" key={booking.id}>
            <div className="job-route"><Plane size={18} /><strong>{booking.pickup}</strong><ChevronRight size={16} /><strong>{booking.dropoff}</strong></div>
            <p>{booking.customer?.name} - {booking.vehicleName} - {new Date(booking.dateTime).toLocaleString()}</p>
            <div className="job-meta">
              <span>{booking.passengers || 1} pax</span>
              <span>{booking.luggage || 0} bags</span>
              <span>{booking.distanceMiles} mi</span>
              <strong>{money(booking.quote.total, currency)}</strong>
              <button className="secondary" type="button" onClick={() => onInvoice(booking.id)}><FileText size={18} /> Invoice</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InvoiceModal({ bookingId, onClose }) {
  const [payload, setPayload] = useState(null);
  useEffect(() => { api.get(`/api/bookings/${bookingId}`).then(setPayload); }, [bookingId]);
  if (!payload) return null;
  const { booking, company } = payload;
  return (
    <div className="modal">
      <div className="invoice">
        <button className="close" onClick={onClose}>Close</button>
        <header>
          <div className="invoice-brand"><Plane size={26} /><div><h2>{company.name}</h2><p>{company.email} - {company.phone}</p></div></div>
          {company.logoUrl && <img src={company.logoUrl} alt="" />}
        </header>
        <h3>Invoice {booking.id}</h3>
        <dl>
          <dt>Passenger</dt><dd>{booking.customer.name} ({booking.customer.email})</dd>
          <dt>Route</dt><dd>{booking.pickup} to {booking.dropoff}</dd>
          <dt>Stops</dt><dd>{booking.extraStops.filter(Boolean).join(", ") || "None"}</dd>
          <dt>Vehicle</dt><dd>{booking.vehicleName}</dd>
          <dt>Flight</dt><dd>{booking.flightNumber || "Not supplied"}</dd>
          <dt>Date</dt><dd>{new Date(booking.dateTime).toLocaleString()}</dd>
          <dt>Passengers</dt><dd>{booking.passengers || 1} passenger(s), {booking.luggage || 0} luggage</dd>
        </dl>
        <table>
          <tbody>
            <tr><td>Base fare</td><td>{money(booking.quote.basePrice, company.currency)}</td></tr>
            <tr><td>Extra drop-offs</td><td>{money(booking.quote.extraStopTotal, company.currency)}</td></tr>
            <tr><td>Meet & greet</td><td>{money(booking.quote.meetAndGreetTotal, company.currency)}</td></tr>
            <tr><td>Child seats</td><td>{money(booking.quote.childSeatTotal, company.currency)}</td></tr>
            <tr><td>Night surcharge</td><td>{money(booking.quote.nightSurcharge, company.currency)}</td></tr>
            <tr><td>Return trip</td><td>{money(booking.quote.returnTripTotal, company.currency)}</td></tr>
            <tr className="total"><td>Total</td><td>{money(booking.quote.total, company.currency)}</td></tr>
          </tbody>
        </table>
        <div className="invoice-actions">
          <button className="secondary" onClick={() => window.print()}><Printer size={18} /> Print</button>
          <button className="secondary" onClick={() => window.print()}><Download size={18} /> PDF</button>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ icon, label, title }) {
  return <div className="step-title"><span>{icon}</span><div><small>{label}</small><h2>{title}</h2></div></div>;
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "", ...props }) {
  return <label>{label}<input type={type} value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function Toggle({ checked, onChange, icon, label }) {
  return <button className={`toggle ${checked ? "checked" : ""}`} type="button" onClick={() => onChange(!checked)}>{icon}<span>{label}</span><Check size={16} /></button>;
}

function Metric({ label, value, icon }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function money(value, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

async function parse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

createRoot(document.getElementById("root")).render(<App />);
