"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Search, ArrowUpDown, Edit2, Trash2, X, ChevronDown,
  SortAsc, SortDesc, Briefcase, ArrowUpRight,
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Project, ProjectStatus, Client } from "@/types";
import Loading from "@/components/Loading";
import {
  ProjectEditorView,
  statusMeta,
  generateProjectNumber,
  FormState,
} from "@/components/ProjectEditorView";

type SortKey = "projectNumber" | "clientName" | "projectName" | "status" | "createdAt";
type SortDir = "asc" | "desc";

function ProjectsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clients, savedQuotes, projects, saveProject, deleteProject } = useData();
  const { session } = useAuth();

  const urlId   = searchParams.get("id");
  const urlMode = searchParams.get("mode");
  const mode = urlMode === "editor" ? "editor" : "list";

  const navigate = useCallback((m: "list" | "editor", id?: string) => {
    if (m === "list") router.push("/dashboard/projects");
    else router.push(`/dashboard/projects?${id ? `id=${id}&` : ""}mode=editor`);
  }, [router]);

  const editingProject = useMemo(
    () => (urlId ? projects.find(p => p.id === urlId) : undefined),
    [urlId, projects]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {};
    for (const c of clients) map[c.id] = c;
    return map;
  }, [clients]);

  const displayed = useMemo(() => {
    let list = [...projects];
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p => {
        const client = clientMap[p.clientId];
        return (
          p.projectNumber.toLowerCase().includes(s) ||
          p.projectName.toLowerCase().includes(s) ||
          (p.description ?? "").toLowerCase().includes(s) ||
          (client?.name ?? "").toLowerCase().includes(s) ||
          (client?.internalId ?? "").toLowerCase().includes(s) ||
          (p.siteCity ?? "").toLowerCase().includes(s)
        );
      });
    }
    if (filterStatus) list = list.filter(p => p.status === filterStatus);
    list.sort((a, b) => {
      let av: string, bv: string;
      if (sortKey === "clientName") {
        av = clientMap[a.clientId]?.name ?? "";
        bv = clientMap[b.clientId]?.name ?? "";
      } else if (sortKey === "createdAt") {
        av = a.createdAt ? new Date(a.createdAt).toISOString() : "";
        bv = b.createdAt ? new Date(b.createdAt).toISOString() : "";
      } else {
        av = (a as any)[sortKey] ?? "";
        bv = (b as any)[sortKey] ?? "";
      }
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, searchTerm, filterStatus, sortKey, sortDir, clientMap]);

  const handleSave = async (form: FormState, project?: Project) => {
    const client = clientMap[form.clientId];
    if (!client) return;
    const now = new Date();
    const projectNumber = project?.projectNumber ?? generateProjectNumber(client, projects);
    const toSave: Project = {
      id: project?.id ?? crypto.randomUUID(),
      projectNumber,
      clientId: form.clientId,
      projectName: form.projectName.trim(),
      status: form.status,
      description: form.description || undefined,
      connectionType: (form.connectionType as any) || undefined,
      roofType: (form.roofType as any) || undefined,
      roofTypeOther: form.roofTypeOther || undefined,
      groundingStatus: (form.groundingStatus as any) || undefined,
      inverterKw: form.inverterKw ? parseFloat(form.inverterKw) : undefined,
      panelKw: form.panelKw ? parseFloat(form.panelKw) : undefined,
      panelCount: form.panelCount ? parseInt(form.panelCount) : undefined,
      batteryKwh: form.batteryKwh ? parseFloat(form.batteryKwh) : undefined,
      batteryPresent: form.batteryPresent || undefined,
      storage: form.storage || undefined,
      technicalNotes: form.technicalNotes || undefined,
      siteCountry: form.siteCountry || undefined,
      siteCounty: form.siteCounty || undefined,
      siteCity: form.siteCity || undefined,
      siteStreet: form.siteStreet || undefined,
      siteStreetNumber: form.siteStreetNumber || undefined,
      sitePostalCode: form.sitePostalCode || undefined,
      siteImages: form.siteImages.length > 0 ? form.siteImages : undefined,
      linkedQuoteId: form.linkedQuoteId || undefined,
      createdAt: project?.createdAt ?? now,
      createdBy: project?.createdBy ?? (session?.nickname ?? "admin"),
      updatedAt: project ? now : undefined,
      updatedBy: project ? (session?.nickname ?? "admin") : undefined,
    };
    await saveProject(toSave);
    navigate("list");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteProject(id);
    setDeletingId(null);
  };

  if (mode === "editor") {
    return (
      <ProjectEditorView
        initialProject={editingProject}
        clients={clients}
        savedQuotes={savedQuotes}
        projects={projects}
        onSave={handleSave}
        onBack={() => navigate("list")}
      />
    );
  }

  const activeFilters = filterStatus ? 1 : 0;

  return (
    <div className="h-full flex flex-col bg-slate-900 p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-slate-400">
            {displayed.length} result{displayed.length !== 1 ? "s" : ""}
            {projects.length !== displayed.length && ` of ${projects.length} total`}
          </p>
        </div>
        <button
          onClick={() => navigate("editor")}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 self-start md:self-auto transition-colors"
        >
          <Plus size={20} /> New Project
        </button>
      </header>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by client, project name, number, or city..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                  dropdownOpen || activeFilters > 0
                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                    : "bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
                }`}
              >
                <ArrowUpDown size={15} />
                Sort / Filter
                {activeFilters > 0 && (
                  <span className="bg-amber-500 text-slate-900 text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {activeFilters}
                  </span>
                )}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 z-40 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sort by</p>
                    <div className="space-y-0.5">
                      {([
                        ["createdAt", "Date created"],
                        ["projectNumber", "Project #"],
                        ["clientName", "Client"],
                        ["projectName", "Name"],
                        ["status", "Status"],
                      ] as [SortKey, string][]).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => {
                            if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
                            else { setSortKey(k); setSortDir("asc"); }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            sortKey === k ? "bg-amber-500/10 text-amber-400" : "text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {label}
                          {sortKey === k && (
                            sortDir === "asc" ? <SortAsc size={13} /> : <SortDesc size={13} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-700 mx-3" />
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter by status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["", "draft", "active", "completed", "archived"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setFilterStatus(s as ProjectStatus | "")}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            filterStatus === s
                              ? "bg-amber-500 border-amber-500 text-slate-900"
                              : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white"
                          }`}
                        >
                          {s === "" ? "All" : statusMeta(s as ProjectStatus).label}
                        </button>
                      ))}
                    </div>
                    {filterStatus && (
                      <button
                        onClick={() => setFilterStatus("")}
                        className="mt-2 text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <X size={11} /> Clear filter
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 gap-3">
            <Briefcase size={40} className="opacity-30" />
            <p className="font-medium">
              {searchTerm || filterStatus ? "No projects match your filters." : "No projects yet."}
            </p>
            {!searchTerm && !filterStatus && (
              <button
                onClick={() => navigate("editor")}
                className="mt-1 text-amber-500 hover:text-amber-400 text-sm font-semibold transition-colors"
              >
                + Create your first project
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold w-10">
                    <input type="checkbox" className="rounded border-slate-600 bg-slate-700 accent-amber-500" />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Project #</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-left font-semibold">Project Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">System</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(project => {
                  const client = clientMap[project.clientId];
                  const { label, color, dot } = statusMeta(project.status);
                  const location = [project.siteCity, project.siteCounty].filter(Boolean).join(", ");
                  const sysParts: string[] = [];
                  if (project.panelCount) sysParts.push(`${project.panelCount} panels`);
                  if (project.inverterKw) sysParts.push(`${project.inverterKw} kW`);
                  if (project.batteryKwh) sysParts.push(`${project.batteryKwh} kWh`);
                  return (
                    <tr
                      key={project.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                      onClick={() => navigate("editor", project.id)}
                    >
                      <td className="px-4 py-3.5">
                        <input type="checkbox" className="rounded border-slate-600 bg-slate-700 accent-amber-500" onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-white">{project.projectNumber}</span>
                          <ArrowUpRight size={13} className="text-slate-500 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-300" onClick={e => e.stopPropagation()}>
                        {client ? (
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] text-slate-300 font-bold flex-shrink-0">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                            <a href={`/dashboard/clients/${client.id}/data`} className="hover:text-amber-400 transition-colors">{client.name}</a>
                          </div>
                        ) : (
                          <span className="text-slate-500">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-white font-medium max-w-[200px] truncate">{project.projectName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">
                        {location || <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                        {sysParts.join(" / ") || <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate("editor", project.id)}
                            className="text-slate-400 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-amber-500/10"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          {client && (
                            <a
                              href={`/dashboard/clients/${client.id}/data`}
                              className="text-slate-400 hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-blue-500/10"
                              title="View client"
                            >
                              <ArrowUpRight size={13} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(project.id)}
                            disabled={deletingId === project.id}
                            className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <ProjectsListPage />
    </Suspense>
  );
}
