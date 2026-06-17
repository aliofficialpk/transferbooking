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
  Download,
  FileText,
  Gauge,
  HelpCircle,
  Lock,
  MapPin,
  Moon,
  Plane,
  Plus,
  Printer,
  Route,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  WalletCards
} from "lucide-react";
import "./styles.css";

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL || "http://127.0.0.1:4000");

function resolveApiUrl(rawValue) {
  const fallback = "http://127.0.0.1:4000";
  const candidates = String(rawValue || fallback)
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const isLocalPage = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const preferred = candidates.find((candidate) => {
    try {
      const hostname = new URL(candidate).hostname;
      const isLocalApi = ["localhost", "127.0.0.1", "::1"].includes(hostname);
      return isLocalPage ? isLocalApi : !isLocalApi;
    } catch {
      return false;
    }
  });
  return preferred || candidates[0] || fallback;
}

const api = {
  token: localStorage.getItem("adminToken") || "",
  async get(path, admin = false) {
    return request(path, { method: "GET" }, admin);
  },
  async post(path, body, admin = false) {
    return request(path, { method: "POST", body: JSON.stringify(body) }, admin);
  },
  async put(path, body, admin = false) {
    return request(path, { method: "PUT", body: JSON.stringify(body) }, admin);
  },
  async patch(path, body, admin = false) {
    return request(path, { method: "PATCH", body: JSON.stringify(body) }, admin);
  }
};

async function request(path, options, admin) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(admin && api.token ? { Authorization: `Bearer ${api.token}` } : {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function App() {
  const [route, setRoute] = useHashRoute();
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [toast, setToast] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [justBookedInfo, setJustBookedInfo] = useState(null);

  function bookVehicle(vehicleId) {
    setSelectedVehicleId(vehicleId);
    setRoute("book");
  }

  function handleBookingComplete(bookingId, customerEmail) {
    setJustBookedInfo({ bookingId, customerEmail });
    setInvoiceId(bookingId);
  }

  function handleInvoiceClosed() {
    if (justBookedInfo) {
      setRoute("my-booking");
      setInvoiceId("");
    }
  }

  async function refreshConfig() {
    setConfigError("");
    try {
      setConfig(await api.get("/api/public/config"));
    } catch (error) {
      setConfigError(error.message);
      setToast(error.message);
    }
  }

  useEffect(() => {
    refreshConfig();
  }, []);

  if (!config) {
    return (
      <main className="loading">
        <div className="loading-card">
          <Plane size={30} />
          <h1>Preparing your chauffeur booking</h1>
          <p>{configError || "Loading vehicles, fares and travel options."}</p>
          {configError && <button className="action-button" onClick={refreshConfig}>Retry connection</button>}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Header company={config.company} route={route} setRoute={setRoute} />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      {route === "home" && <HomePage config={config} setRoute={setRoute} onSelectVehicle={bookVehicle} />}
      {route === "book" && <BookingPage config={config} onInvoice={handleBookingComplete} onToast={setToast} initialVehicleId={selectedVehicleId} />}
      {route === "my-booking" && <MyBookingPage company={config.company} onToast={setToast} justBookedInfo={justBookedInfo} onBookingViewed={() => setJustBookedInfo(null)} />}
      {route === "fleet" && <FleetPage config={config} setRoute={setRoute} onSelectVehicle={bookVehicle} selectedVehicleId={selectedVehicleId} />}
      {route === "how" && <HowPage />}
      {route === "staff-login" && <AdminLogin setRoute={setRoute} onToast={setToast} />}
      {route === "admin" && <AdminDashboard publicConfig={config} refreshPublicConfig={refreshConfig} onToast={setToast} />}
      {invoiceId && <InvoiceModal bookingId={invoiceId} company={config.company} onClose={handleInvoiceClosed} />}
    </main>
  );
}

function useHashRoute() {
  const getRoute = () => (location.hash.replace("#/", "") || "home").split("?")[0];
  const [route, setRouteState] = useState(getRoute());
  useEffect(() => {
    const onHash = () => setRouteState(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  function setRoute(next) {
    location.hash = `/${next}`;
  }
  return [route, setRoute];
}

function Header({ company, route, setRoute }) {
  return (
    <header className="topbar">
      <button className="brand-button" type="button" onClick={() => setRoute("home")}>
        <span className="brand-mark"><Plane size={18} /></span>
        <span>
          <strong>{company.name}</strong>
          <small>Airport chauffeur transfers</small>
        </span>
      </button>
      <nav className="nav-tabs">
        {[
          ["home", "Home"],
          ["book", "Book"],
          ["my-booking", "My Booking"],
          ["fleet", "Fleet"],
          ["how", "Help"]
        ].map(([id, label]) => (
          <button key={id} className={route === id ? "active" : ""} onClick={() => setRoute(id)}>{label}</button>
        ))}
      </nav>
    </header>
  );
}

function HomePage({ config, setRoute, onSelectVehicle }) {
  return (
    <>
      <section className="hero-stage">
        <VehicleScene />
        <div className="hero-copy">
          <p className="eyebrow">Airport transfers without surprises</p>
          <h1>Professional chauffeur transfers for airports, hotels and business travel.</h1>
          <p className="hero-lead">Book a fixed-fare private transfer with clear pricing before you confirm. Choose the right vehicle, add flight details, request meet-and-greet, and receive a booking reference with invoice details.</p>
          <div className="hero-actions">
            <button className="action-button" onClick={() => setRoute("book")}><CalendarClock size={18} /> Start booking</button>
            <button className="secondary dark" onClick={() => setRoute("fleet")}><Car size={18} /> View fleet</button>
          </div>
          <div className="hero-stats">
            <span><ShieldCheck size={16} /> Fixed fare before booking</span>
            <span><Route size={16} /> Extra stops supported</span>
            <span><Moon size={16} /> Late-night pickups available</span>
          </div>
        </div>
      </section>
      <GuideSection />
      <ServiceHighlights />
      <FleetPreview config={config} setRoute={setRoute} onSelectVehicle={onSelectVehicle} />
      <AirportCoverage />
      <FaqSection />
    </>
  );
}

function VehicleScene() {
  const mountRef = useRef(null);
  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0e171d, 7, 18);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 4.4, 8.8);
    camera.lookAt(0, 0.25, -2.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 22), new THREE.MeshStandardMaterial({ color: 0x22292e, metalness: 0.16, roughness: 0.54 }));
    road.rotation.x = -Math.PI / 2;
    road.position.z = -3;
    scene.add(road);

    const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xe8eef2, emissive: 0x20282d, emissiveIntensity: 0.2, roughness: 0.45 });
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
    ].map((item) => {
      const group = createVehicle(item);
      group.position.set(item.lane, 0, item.z);
      scene.add(group);
      return { ...item, group };
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x29323a, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(2, 8, 4);
    scene.add(key);

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
        if (moving.group.position.z > 8.8) moving.group.position.z = -14.2 - Math.random() * 3.5;
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

  return <div className="route-scene" ref={mountRef} />;
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

  addBox(group, width, bodyHeight, length, paint, 0, 0.46, 0);
  addBox(group, width * 0.78, isVan ? 0.58 : 0.44, isVan ? 1.55 : 1.08, glass, 0, isVan ? 0.98 : 0.78, isVan ? -0.18 : -0.2);
  addBox(group, width * 0.84, 0.16, isVan ? 0.52 : 0.76, paint, 0, isVan ? 0.84 : 0.58, length / 2 - (isVan ? 0.36 : 0.48));
  addBox(group, width * 0.72, 0.08, isVan ? 1.45 : 0.9, paint, 0, isVan ? 1.31 : 1.04, isVan ? -0.18 : -0.22);
  addBox(group, width * 0.48, 0.14, 0.04, chrome, 0, 0.5, length / 2 + 0.025);
  addBox(group, width * 0.84, 0.1, 0.08, chrome, 0, 0.32, length / 2 + 0.04);

  for (const x of [-width * 0.33, width * 0.33]) {
    addBox(group, width * 0.18, 0.08, 0.04, light, x, 0.56, length / 2 + 0.06);
    addBox(group, width * 0.15, 0.08, 0.04, tail, x, 0.55, -length / 2 - 0.035);
  }
  for (const x of [-width * 0.57, width * 0.57]) addBox(group, 0.12, 0.06, 0.18, paint, x, isVan ? 0.96 : 0.76, length * 0.15);
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
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.scale.set(width * 0.72, length * 0.62, 1);
  group.add(shadow);
  group.scale.setScalar(scale);
  return group;
}

function addBox(group, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
}

function GuideSection() {
  return (
    <section className="guide-section">
      <div className="guide-intro">
        <p className="eyebrow">How your journey works</p>
        <h2>From airport arrival to destination, every detail is clear.</h2>
        <p>Tell us where and when you are travelling, choose the vehicle that fits your passengers and luggage, then confirm a fixed fare. Your booking reference lets you check details again any time.</p>
      </div>
      <div className="guide-grid">
        <GuideCard icon={<MapPin size={20} />} title="Enter your journey" text="Add airport, hotel, home address or extra stops. Include your flight number so the operator has the right arrival details." />
        <GuideCard icon={<Car size={20} />} title="Choose your vehicle" text="Select a saloon, executive car, MPV or group van based on passenger and luggage needs." />
        <GuideCard icon={<WalletCards size={20} />} title="See the full fare" text="The quote shows vehicle fare, stops, meet-and-greet, child seats, night surcharge and return-trip options." />
        <GuideCard icon={<ClipboardCheck size={20} />} title="Confirm and track" text="After confirmation, use your booking reference and email to view status, passenger details and invoice summary." />
      </div>
    </section>
  );
}

function GuideCard({ icon, title, text }) {
  return <article><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}

function FleetPreview({ config, setRoute, onSelectVehicle }) {
  return (
    <section className="content-band">
      <div className="section-head">
        <p className="eyebrow">Our chauffeur fleet</p>
        <h2>Vehicles for solo travellers, families and business groups.</h2>
        <button className="secondary" onClick={() => setRoute("fleet")}>Explore all</button>
      </div>
      <div className="fleet-grid">
        {config.vehicles.slice(0, 3).map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={onSelectVehicle} />
        ))}
      </div>
    </section>
  );
}

function FleetPage({ config, setRoute, onSelectVehicle, selectedVehicleId }) {
  return (
    <section className="page">
      <PageTitle label="Fleet" title="Choose the right vehicle for your transfer." text="Our fleet covers business travellers, VIP passengers, families with luggage and group airport transfers. Capacity and luggage guidance is shown before you book." />
      <div className="fleet-grid">{config.vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={onSelectVehicle} selected={vehicle.id === selectedVehicleId} />
      ))}</div>
      <button className="action-button narrow" onClick={() => setRoute("book")}><CalendarClock size={18} /> Book a transfer</button>
    </section>
  );
}

function MyBookingPage({ company, onToast, justBookedInfo, onBookingViewed }) {
  const [lookup, setLookup] = useState({ bookingId: justBookedInfo?.bookingId || "", email: justBookedInfo?.customerEmail || "" });
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (justBookedInfo?.bookingId && justBookedInfo?.customerEmail) {
      setLookup({ bookingId: justBookedInfo.bookingId, email: justBookedInfo.customerEmail });
      setLoading(true);
      api.post("/api/public/booking-lookup", { bookingId: justBookedInfo.bookingId, email: justBookedInfo.customerEmail })
        .then((result) => {
          setBooking(result);
          onToast("Your booking was created successfully!");
          onBookingViewed?.();
        })
        .catch((error) => onToast(error.message))
        .finally(() => setLoading(false));
    }
  }, [justBookedInfo]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setBooking(null);
    try {
      const result = await api.post("/api/public/booking-lookup", lookup);
      setBooking(result);
      onToast("Booking found.");
    } catch (error) {
      onToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page booking-lookup-page">
      <PageTitle
        label="My booking"
        title="Check your chauffeur transfer details."
        text="Enter the booking reference and passenger email used at confirmation. You can review status, route, vehicle, flight details and invoice breakdown."
      />
      <div className="lookup-grid">
        <form className="booking-card lookup-card" onSubmit={submit}>
          <StepTitle icon={<Search size={19} />} title="Find booking" label="Passenger lookup" />
          <Field label="Booking reference" value={lookup.bookingId} onChange={(value) => setLookup({ ...lookup, bookingId: value })} placeholder="INV or booking reference" required />
          <Field label="Passenger email" type="email" value={lookup.email} onChange={(value) => setLookup({ ...lookup, email: value })} placeholder="you@example.com" required />
          <button className="action-button" type="submit" disabled={loading}>{loading ? "Checking..." : "View my booking"}</button>
          <p className="form-note">For security, the booking reference must match the passenger email on the booking.</p>
        </form>
        <BookingDetails booking={booking} company={company} onViewInvoice={() => setInvoiceModalOpen(true)} />
      </div>
      {booking && invoiceModalOpen && <InvoiceModal bookingId={booking.id} company={company} onClose={() => setInvoiceModalOpen(false)} />}
    </section>
  );
}

function BookingDetails({ booking, company, onViewInvoice }) {
  if (!booking) {
    return (
      <aside className="glass-panel lookup-empty">
        <FileText size={34} />
        <h2>Your booking summary will appear here.</h2>
        <p>After lookup, you will see the assigned vehicle, journey time, fare breakdown, invoice number and current booking status.</p>
      </aside>
    );
  }

  return (
    <aside className="glass-panel booking-details">
      <div className="status-ribbon">
        <span>{booking.status}</span>
        <strong>{booking.id}</strong>
      </div>
      <h2>{booking.pickup} to {booking.dropoff}</h2>
      <dl>
        <dt>Passenger</dt><dd>{booking.customer.name}</dd>
        <dt>Date and time</dt><dd>{new Date(booking.dateTime).toLocaleString()}</dd>
        <dt>Vehicle</dt><dd>{booking.vehicleName}</dd>
        <dt>Flight</dt><dd>{booking.flightNumber || "Not supplied"}</dd>
        <dt>Passengers</dt><dd>{booking.passengers} passenger(s), {booking.luggage} luggage</dd>
        <dt>Extra stops</dt><dd>{booking.extraStops?.length ? booking.extraStops.join(", ") : "None"}</dd>
        <dt>Invoice</dt><dd>{booking.invoiceNumber}</dd>
      </dl>
      <div className="fare-map">
        {Object.entries({
          "Base fare": booking.quote.basePrice,
          "Extra stops": booking.quote.extraStopTotal,
          "Meet & greet": booking.quote.meetAndGreetTotal,
          "Child seats": booking.quote.childSeatTotal,
          "Night surcharge": booking.quote.nightSurcharge,
          "Return trip": booking.quote.returnTripTotal
        }).map(([label, value]) => <React.Fragment key={label}><span>{label}</span><strong>{money(value, booking.currency)}</strong></React.Fragment>)}
        <span>Total</span><strong>{money(booking.quote.total, booking.currency)}</strong>
      </div>
      <div className="booking-actions">
        <button className="secondary" type="button" onClick={onViewInvoice}><FileText size={16} /> View invoice</button>
        <p className="form-note">For amendments, contact {company.phone} or {company.email} with your booking reference.</p>
      </div>
    </aside>
  );
}

function VehicleCard({ vehicle, onSelect, selected }) {
  const handleClick = onSelect ? () => onSelect(vehicle.id) : undefined;

  return (
    <article
      className={`vehicle-card ${onSelect ? "clickable" : ""} ${selected ? "selected" : ""}`}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      <div className="vehicle-visual"><Car size={46} /></div>
      <p>{vehicle.category}</p>
      <h3>{vehicle.name}</h3>
      <span><Users size={15} /> {vehicle.capacity} passengers</span>
      <span><Briefcase size={15} /> {vehicle.luggage} luggage</span>
      <small>{vehicle.description}</small>
      {onSelect && <small className="vehicle-action-hint">Tap to select and book</small>}
    </article>
  );
}

function ServiceHighlights() {
  return (
    <section className="content-band service-band">
      <div className="section-head">
        <div>
          <p className="eyebrow">Why book with us</p>
          <h2>Built around reliable airport travel.</h2>
        </div>
      </div>
      <div className="service-grid">
        <GuideCard icon={<Plane size={20} />} title="Airport pickup ready" text="Add your flight number and pickup time so the operator has your arrival details before dispatch." />
        <GuideCard icon={<ShieldCheck size={20} />} title="Clear confirmed fare" text="See your transfer cost before booking, including premium extras and late-night charges where applicable." />
        <GuideCard icon={<Users size={20} />} title="Passenger and luggage fit" text="Vehicle cards show passenger and luggage capacity so you can choose comfortably." />
        <GuideCard icon={<FileText size={20} />} title="Invoice included" text="Every confirmed booking has invoice details available through the booking reference lookup." />
      </div>
    </section>
  );
}

function AirportCoverage() {
  const airports = ["Heathrow", "Gatwick", "Luton", "Stansted", "London City", "Southampton"];
  return (
    <section className="content-band airport-band">
      <div className="section-head">
        <div>
          <p className="eyebrow">Airport coverage</p>
          <h2>Private transfers for major airports and long-distance journeys.</h2>
          <p>Use the booking form for airport pickups, hotel transfers, business meetings, events and family travel. Extra drop-offs are supported for multi-stop journeys.</p>
        </div>
      </div>
      <div className="airport-list">
        {airports.map((airport) => <span key={airport}><Plane size={16} /> {airport}</span>)}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="content-band faq-band">
      <div className="section-head">
        <div>
          <p className="eyebrow">Questions</p>
          <h2>Before you travel.</h2>
        </div>
      </div>
      <div className="faq-grid">
        <GuideCard icon={<WalletCards size={20} />} title="Is the quote fixed?" text="Yes. The fare shown before confirmation is stored with the booking, including selected extras." />
        <GuideCard icon={<MapPin size={20} />} title="Can I add extra stops?" text="Yes. Add one or more extra drop-offs before calculating your quote." />
        <GuideCard icon={<Armchair size={20} />} title="Can I request child seats?" text="Yes. Add the number of child seats in the booking form and the quote updates the breakdown." />
        <GuideCard icon={<FileText size={20} />} title="Where is my invoice?" text="Use My Booking with your reference and email to view invoice details and print the page." />
      </div>
    </section>
  );
}

function HowPage() {
  return (
    <section className="page">
      <PageTitle label="Help" title="Everything customers need to know before booking." text="Use this guide to understand quotes, booking references, airport pickups, extras and invoices." />
      <div className="timeline">
        <GuideCard icon={<Route size={20} />} title="1. Add route details" text="Enter pickup, drop-off, date, time, passengers, luggage and optional stops." />
        <GuideCard icon={<Gauge size={20} />} title="2. Review the fare" text="Your quote is itemised so you can see the vehicle fare and any extras before confirming." />
        <GuideCard icon={<Check size={20} />} title="3. Receive a reference" text="After booking, keep your reference number and email address for checking your transfer later." />
        <GuideCard icon={<HelpCircle size={20} />} title="4. Need changes?" text="Use your booking reference to review details, then contact the operator if a change is required." />
      </div>
      <FaqSection />
    </section>
  );
}

const locationSuggestions = [
  "Heathrow Terminal 5",
  "Gatwick Airport",
  "London City Airport",
  "Stansted Airport",
  "Luton Airport",
  "Mayfair, London",
  "King's Cross Station",
  "Paddington Station",
  "Canary Wharf",
  "Westminster, London"
];

function BookingPage({ config, onInvoice, onToast, initialVehicleId }) {
  const [form, setForm] = useState({
    pickup: "",
    dropoff: "",
    extraStops: [],
    vehicleId: initialVehicleId || config.vehicles[0]?.id || "",
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
  const selectedVehicle = config.vehicles.find((vehicle) => vehicle.id === form.vehicleId);

  useEffect(() => {
    if (initialVehicleId) {
      setForm((current) =>
        current.vehicleId !== initialVehicleId ? { ...current, vehicleId: initialVehicleId } : current
      );
      setQuote(null);
    }
  }, [initialVehicleId]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setQuote(null);
  }

  function updateOption(key, value) {
    setForm((current) => ({ ...current, serviceOptions: { ...current.serviceOptions, [key]: value } }));
    setQuote(null);
  }

  async function getQuote(event) {
    event.preventDefault();
    try {
      setQuote(await api.post("/api/public/quote", form));
      onToast("Quote calculated from live database pricing.");
    } catch (error) {
      onToast(error.message);
    }
  }

  async function book() {
    try {
      const booking = await api.post("/api/public/bookings", { ...form, distanceMiles: quote.distanceMiles });
      onInvoice(booking.id, form.customer.email);
      onToast(`Booking confirmed: ${booking.id}`);
    } catch (error) {
      onToast(error.message);
    }
  }

  return (
    <section className="booking-grid page-tight">
      <form className="booking-card primary-card" onSubmit={getQuote}>
        <StepTitle icon={<MapPin size={19} />} title="Journey" label="Step 1" />
        <Field label="Pickup" value={form.pickup} onChange={(value) => update("pickup", value)} placeholder="Heathrow Terminal 5" required list="locations" />
        <Field label="Drop-off" value={form.dropoff} onChange={(value) => update("dropoff", value)} placeholder="Mayfair, London" required list="locations" />
        <ExtraStops stops={form.extraStops} onChange={(extraStops) => update("extraStops", extraStops)} list="locations" />
        <datalist id="locations">
          {locationSuggestions.map((location) => <option key={location} value={location} />)}
        </datalist>

        <StepTitle icon={<Car size={19} />} title="Vehicle" label="Step 2" />
        <label>
          Vehicle type
          <select value={form.vehicleId} onChange={(event) => update("vehicleId", event.target.value)}>
            {config.vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
            ))}
          </select>
        </label>
        <div className="vehicle-picker">
          {config.vehicles.map((vehicle) => (
            <button key={vehicle.id} type="button" className={form.vehicleId === vehicle.id ? "selected" : ""} onClick={() => update("vehicleId", vehicle.id)}>
              <Car size={24} /><strong>{vehicle.name}</strong><small>{vehicle.capacity} pax / {vehicle.luggage} bags</small>
            </button>
          ))}
        </div>

        <StepTitle icon={<CalendarClock size={19} />} title="Details" label="Step 3" />
        <div className="compact-grid">
          <label>Date and time<input type="datetime-local" value={form.dateTime} onChange={(event) => update("dateTime", event.target.value)} required /></label>
          <Field label="Distance miles" type="number" step="0.1" value={form.manualDistanceMiles} onChange={(value) => update("manualDistanceMiles", value)} placeholder="Manual until Maps key is set" />
          <Field label="Flight number" value={form.flightNumber} onChange={(value) => update("flightNumber", value)} placeholder="BA117" />
          <Field label="Passengers" type="number" min="1" value={form.passengers} onChange={(value) => update("passengers", Number(value))} />
          <Field label="Luggage" type="number" min="0" value={form.luggage} onChange={(value) => update("luggage", Number(value))} />
          <Field label="Child seats" type="number" min="0" value={form.serviceOptions.childSeats} onChange={(value) => updateOption("childSeats", Number(value))} />
        </div>
        <div className="option-row">
          <Toggle checked={form.serviceOptions.meetAndGreet} onChange={(checked) => updateOption("meetAndGreet", checked)} label="Meet and greet" />
          <Toggle checked={form.serviceOptions.returnTrip} onChange={(checked) => updateOption("returnTrip", checked)} label="Return trip" />
        </div>
        <StepTitle icon={<Users size={19} />} title="Passenger" label="Step 4" />
        <div className="compact-grid customer-grid">
          <Field label="Name" value={form.customer.name} onChange={(value) => update("customer", { ...form.customer, name: value })} required />
          <Field label="Email" type="email" value={form.customer.email} onChange={(value) => update("customer", { ...form.customer, email: value })} required />
          <Field label="Phone" value={form.customer.phone} onChange={(value) => update("customer", { ...form.customer, phone: value })} required />
        </div>
        <label>Driver notes<textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Name board, pickup instructions, mobility needs..." /></label>
        <button className="action-button" type="submit"><Banknote size={18} /> Calculate quote</button>
      </form>
      <aside className="quote-dock">
        <QuotePanel quote={quote} currency={config.company.currency} vehicle={selectedVehicle} onBook={book} />
        <InfoPanel settings={config.settings} />
      </aside>
    </section>
  );
}

function QuotePanel({ quote, currency, vehicle, onBook }) {
  return (
    <div className="quote-panel glass-panel">
      <div className="quote-head"><span><Gauge size={18} /> Live fare</span><strong>{money(quote?.breakdown.total || 0, quote?.currency || currency)}</strong></div>
      {quote ? (
        <>
          <div className="fare-map">
            {Object.entries({
              Base: quote.breakdown.basePrice,
              Stops: quote.breakdown.extraStopTotal,
              "Meet & greet": quote.breakdown.meetAndGreetTotal,
              "Child seats": quote.breakdown.childSeatTotal,
              Night: quote.breakdown.nightSurcharge,
              Return: quote.breakdown.returnTripTotal
            }).map(([label, value]) => <React.Fragment key={label}><span>{label}</span><strong>{money(value, quote.currency)}</strong></React.Fragment>)}
          </div>
          <div className="quote-route"><Route size={18} /><span>{quote.distanceMiles} miles {quote.slab ? `• ${quote.slab.label || `${quote.slab.minMiles}-${quote.slab.maxMiles}`}` : "• Per-mile pricing"}</span></div>
          <button className="action-button" type="button" onClick={onBook}><CalendarClock size={18} /> Confirm booking</button>
        </>
      ) : (
        <div className="empty-quote"><Car size={30} /><p>Select a route and vehicle to reveal an instant fare.</p><small>{vehicle?.name || "Fleet"} pricing is loaded from PostgreSQL.</small></div>
      )}
    </div>
  );
}

function InfoPanel({ settings }) {
  return <div className="feature-rail"><article><Sparkles size={19} /><span>Meet & greet</span><strong>{money(settings.meetAndGreetAmount)}</strong></article><article><Armchair size={19} /><span>Child seat</span><strong>{money(settings.childSeatAmount)}</strong></article><article><Moon size={19} /><span>Night cover</span><strong>{settings.nightSurchargePercent}%</strong></article></div>;
}

function AdminLogin({ setRoute, onToast }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  async function submit(event) {
    event.preventDefault();
    try {
      const result = await api.post("/api/admin/login", credentials);
      api.token = result.token;
      localStorage.setItem("adminToken", result.token);
      onToast("Admin session started.");
      setRoute("admin");
    } catch (error) {
      onToast(error.message);
    }
  }
  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Lock size={28} />
        <h1>Staff access</h1>
        <p>This hidden portal is for operators only. Use it to manage bookings, vehicles and pricing.</p>
        <Field label="Username" value={credentials.username} onChange={(value) => setCredentials({ ...credentials, username: value })} required />
        <Field label="Password" type="password" value={credentials.password} onChange={(value) => setCredentials({ ...credentials, password: value })} required />
        <button className="action-button" type="submit">Sign in</button>
      </form>
    </section>
  );
}

function AdminDashboard({ refreshPublicConfig, onToast }) {
  const [config, setConfig] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState("");

  async function refresh() {
    const [nextConfig, nextDashboard, nextBookings] = await Promise.all([
      api.get("/api/admin/config", true),
      api.get("/api/admin/dashboard", true),
      api.get("/api/admin/bookings", true)
    ]);
    setConfig(nextConfig);
    setDashboard(nextDashboard);
    setBookings(nextBookings);
  }

  useEffect(() => {
    refresh().catch(() => location.hash = "/staff-login");
  }, []);

  if (!config || !dashboard) return <main className="loading">Loading admin...</main>;
  const filtered = bookings.filter((booking) => JSON.stringify(booking).toLowerCase().includes(query.toLowerCase()));

  async function saveConfig() {
    try {
      await api.put("/api/admin/config", config, true);
      await refreshPublicConfig();
      onToast("Fleet and pricing saved to PostgreSQL.");
    } catch (error) {
      onToast(error.message);
    }
  }

  function updateVehicle(id, patch) {
    setConfig((current) => ({ ...current, vehicles: current.vehicles.map((vehicle) => vehicle.id === id ? { ...vehicle, ...patch } : vehicle) }));
  }

  function updatePrice(vehicleId, slabId, price) {
    setConfig((current) => ({ ...current, vehicles: current.vehicles.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, prices: { ...vehicle.prices, [slabId]: Number(price) } } : vehicle) }));
  }

  return (
    <section className="admin-page">
      <div className="metrics">
        <Metric label="Bookings" value={dashboard.totalBookings} icon={<CalendarClock />} />
        <Metric label="Revenue" value={money(dashboard.revenue, config.company.currency)} icon={<Banknote />} />
        <Metric label="Active fleet" value={dashboard.activeVehicles} icon={<Car />} />
      </div>
      <div className="admin-panel">
        <div className="panel-title"><Settings size={20} /><h2>Fleet pricing matrix</h2><button className="action-button small" onClick={saveConfig}><Save size={18} /> Save</button></div>
        <div className="matrix">
          <table>
            <thead><tr><th>Vehicle</th><th>Category</th><th>Seats</th><th>Bags</th><th>Live</th>{config.slabs.map((slab) => <th key={slab.id}>{slab.label}</th>)}</tr></thead>
            <tbody>{config.vehicles.map((vehicle) => <tr key={vehicle.id}>
              <td><input value={vehicle.name} onChange={(event) => updateVehicle(vehicle.id, { name: event.target.value })} /></td>
              <td><input value={vehicle.category} onChange={(event) => updateVehicle(vehicle.id, { category: event.target.value })} /></td>
              <td><input type="number" value={vehicle.capacity} onChange={(event) => updateVehicle(vehicle.id, { capacity: Number(event.target.value) })} /></td>
              <td><input type="number" value={vehicle.luggage} onChange={(event) => updateVehicle(vehicle.id, { luggage: Number(event.target.value) })} /></td>
              <td><input type="checkbox" checked={vehicle.active} onChange={(event) => updateVehicle(vehicle.id, { active: event.target.checked })} /></td>
              {config.slabs.map((slab) => <td key={slab.id}><input type="number" value={vehicle.prices[slab.id] || 0} onChange={(event) => updatePrice(vehicle.id, slab.id, event.target.value)} /></td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="jobs-header"><StepTitle icon={<FileText />} title="Booking management" label={`${bookings.length} stored`} /><div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bookings" /></div></div>
      <div className="booking-list">{filtered.map((booking) => <BookingRow key={booking.id} booking={booking} currency={config.company.currency} refresh={refresh} onToast={onToast} />)}</div>
    </section>
  );
}

function BookingRow({ booking, currency, refresh, onToast }) {
  async function changeStatus(status) {
    try {
      await api.patch(`/api/admin/bookings/${booking.id}/status`, { status }, true);
      await refresh();
      onToast("Booking status updated.");
    } catch (error) {
      onToast(error.message);
    }
  }
  return (
    <article className="job-card">
      <div className="job-route"><Plane size={18} /><strong>{booking.pickup}</strong><ChevronRight size={16} /><strong>{booking.dropoff}</strong></div>
      <p>{booking.customer.name} - {booking.vehicleName} - {new Date(booking.dateTime).toLocaleString()}</p>
      <div className="job-meta"><span>{booking.status}</span><span>{booking.passengers} pax</span><span>{booking.distanceMiles} mi</span><strong>{money(booking.quote.total, currency)}</strong><select value={booking.status} onChange={(event) => changeStatus(event.target.value)}><option>confirmed</option><option>assigned</option><option>completed</option><option>cancelled</option></select></div>
    </article>
  );
}

function InvoiceModal({ bookingId, company, onClose }) {
  const [booking, setBooking] = useState(null);
  useEffect(() => { api.get(`/api/public/bookings/${bookingId}`).then(setBooking); }, [bookingId]);
  if (!booking) return (
    <div className="modal">
      <div className="invoice">
        <div style={{ display: "grid", gap: "12px", justifyItems: "center", padding: "40px" }}>
          <Plane size={32} style={{ color: "#0f766e" }} />
          <h2>Processing your booking...</h2>
          <p style={{ color: "#657179" }}>Please wait while we finalize your invoice.</p>
        </div>
      </div>
    </div>
  );
  return (
    <div className="modal">
      <div className="invoice">
        <button className="close" onClick={onClose}>Close</button>
        <div className="booking-success-banner">
          <Check size={24} style={{ color: "#0f766e" }} />
          <div>
            <strong>Booking Confirmed!</strong>
            <small>Reference: {booking.id}</small>
          </div>
        </div>
        <header><div className="invoice-brand"><Plane size={26} /><div><h2>{company.name}</h2><p>{company.email} - {company.phone}</p></div></div></header>
        <h3>Invoice {booking.invoiceNumber}</h3>
        <dl>
          <dt>Passenger</dt><dd>{booking.customer.name} ({booking.customer.email})</dd>
          <dt>Route</dt><dd>{booking.pickup} to {booking.dropoff}</dd>
          <dt>Vehicle</dt><dd>{booking.vehicleName}</dd>
          <dt>Flight</dt><dd>{booking.flightNumber || "Not supplied"}</dd>
          <dt>Date</dt><dd>{new Date(booking.dateTime).toLocaleString()}</dd>
        </dl>
        <table><tbody>{Object.entries({ "Base fare": booking.quote.basePrice, "Extra drop-offs": booking.quote.extraStopTotal, "Meet & greet": booking.quote.meetAndGreetTotal, "Child seats": booking.quote.childSeatTotal, "Night surcharge": booking.quote.nightSurcharge, "Return trip": booking.quote.returnTripTotal }).map(([label, value]) => <tr key={label}><td>{label}</td><td>{money(value, booking.currency)}</td></tr>)}<tr className="total"><td>Total</td><td>{money(booking.quote.total, booking.currency)}</td></tr></tbody></table>
        <div className="invoice-actions"><button className="secondary" onClick={() => window.print()}><Printer size={18} /> Print</button><button className="secondary" onClick={() => window.print()}><Download size={18} /> PDF</button><button className="action-button" onClick={onClose}><Check size={18} /> View in My Booking</button></div>
      </div>
    </div>
  );
}

function ExtraStops({ stops, onChange }) {
  return <div className="stops"><div className="row-title"><span>Extra drop-offs</span><button type="button" className="icon-button" onClick={() => onChange([...stops, ""])}><Plus size={18} /></button></div>{stops.map((stop, index) => <div className="stop-row" key={index}><input value={stop} onChange={(event) => onChange(stops.map((item, i) => i === index ? event.target.value : item))} placeholder={`Stop ${index + 1}`} /><button type="button" className="icon-button danger" onClick={() => onChange(stops.filter((_, i) => i !== index))}><Trash2 size={18} /></button></div>)}</div>;
}

function PageTitle({ label, title, text }) {
  return <div className="page-title"><p className="eyebrow">{label}</p><h1>{title}</h1><p>{text}</p></div>;
}

function StepTitle({ icon, label, title }) {
  return <div className="step-title"><span>{icon}</span><div><small>{label}</small><h2>{title}</h2></div></div>;
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "", ...props }) {
  return <label>{label}<input type={type} value={value} required={required} placeholder={placeholder} list={props.list} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function Toggle({ checked, onChange, label }) {
  return <button className={`toggle ${checked ? "checked" : ""}`} type="button" onClick={() => onChange(!checked)}><Sparkles size={17} /><span>{label}</span><Check size={16} /></button>;
}

function Metric({ label, value, icon }) {
  return <div className="metric">{icon}<span>{label}</span><strong>{value}</strong></div>;
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timeout = setTimeout(onClose, 3500);
    return () => clearTimeout(timeout);
  }, [message]);
  return <div className="toast"><Check size={17} /> {message}</div>;
}

function money(value, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(value || 0));
}

const rootElement = document.getElementById("root");
rootElement.__airportTransferRoot = rootElement.__airportTransferRoot || createRoot(rootElement);
rootElement.__airportTransferRoot.render(<App />);
