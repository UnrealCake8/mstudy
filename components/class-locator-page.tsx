"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { DEFAULT_SES, roomLocation, SchoolConfig, subscribeSchoolConfig } from "@/lib/school-data";

export function ClassLocatorPage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const initialRoom = params.get("room") || "";
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [query, setQuery] = useState(initialRoom);
  const [submitted, setSubmitted] = useState(initialRoom);

  useEffect(() => subscribeSchoolConfig("ses", value => setConfig(value || DEFAULT_SES)), []);
  const result = useMemo(() => roomLocation(submitted, config || DEFAULT_SES), [submitted, config]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(query);
  }

  return <section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Find your way</p><h1>Class Locator</h1><p>Enter a classroom code and MStudy will tell you the building and room.</p></div>
    </div>

    <section className="locator-card">
      <form className="locator-form" onSubmit={submit}>
        <label htmlFor="room-code">Room code</label>
        <div className="locator-input-row">
          <input id="room-code" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. A204, S105 or P312" autoComplete="off" />
          <button className="primary-button" type="submit"><Search size={17}/> Find room</button>
        </div>
      </form>
      {result ? <div className="locator-result" aria-live="polite">
        <div className="connect-icon"><Building2 size={24}/></div>
        <div><p className="eyebrow">{result.code}</p><h2>{result.building}</h2><p><MapPin size={15}/> Room {result.room}</p></div>
      </div> : null}
    </section>

    <section className="locator-help">
      <h2 className="section-title">Room prefixes</h2>
      <div className="locator-prefix-grid">{(config || DEFAULT_SES).roomPrefixes.map(item => <article key={item.prefix}><strong>{item.prefix}</strong><span>{item.building}</span></article>)}</div>
    </section>
    {user?.email ? <p className="section-help">Signed in as {user.email}</p> : null}
  </section>;
}
