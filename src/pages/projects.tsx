import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import { useCodexStore } from "@/stores/useCodexStore";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";

interface Project {
  path: string;
  trust_level: string;
}

async function fetchProjects(): Promise<Project[]> {
  return await invoke("read_codex_config");
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { setCwd } = useCodexStore();
  const navigate = useNavigate();

  const handleProjectClick = (projectPath: string) => {
    setCwd(projectPath);
    navigate("/chat");
  };

  const openProject = async () => {
    const result = await open({
      directory: true,
      multiple: false,
    });
    if (result) {
      console.log("open project", result);
      handleProjectClick(result);
    }
  };
  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (project) =>
        project.path.toLowerCase().includes(term) ||
        project.path.split("/").pop()?.toLowerCase().includes(term),
    );
  }, [searchTerm, projects]);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchProjects();
      console.log("projects:", data);
      setProjects(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl py-6">
        <div className="flex items-center justify-between mb-6">
          <input
            autoFocus={true}
            type="text"
            placeholder="Search projects..."
            className="block w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.currentTarget.value)
            }
          />
          <button
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent active:bg-accent transition-colors"
            onClick={load}
            disabled={loading}
          >
            <span>Refresh</span>
          </button>

          <div className="flex">
            <Button variant="outline" onClick={openProject}>
              Open project
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-start justify-between gap-4">
              <p>Failed to load projects: {error}</p>
              <button
                className="rounded-md border border-destructive px-2 py-1 hover:bg-destructive/10"
                onClick={load}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loading && (
          <ul className="space-y-3">
            {[1, 2, 3].map((_, index) => (
              <li
                key={index}
                className="rounded-lg border bg-background p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {!loading && filteredProjects.length === 0 && !error && (
          <div className="rounded-lg border bg-background p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {searchTerm
                ? "No projects match your search."
                : "No projects found."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchTerm
                ? "Try a different search term."
                : "Add entries to your config to see them here."}
            </p>
          </div>
        )}

        {!loading && filteredProjects.length > 0 && (
          <ul className="space-y-3">
            {filteredProjects.map((project) => (
              <li key={project.path}>
                <div
                  onClick={() => handleProjectClick(project.path)}
                  className="group block rounded-lg border bg-background p-4 shadow-sm transition hover:border-accent hover:bg-accent cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold tracking-tight">
                      {project.path.split("/").pop()}
                    </span>
                    <span>{project.trust_level}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground group-hover:text-foreground">
                    {project.path}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
