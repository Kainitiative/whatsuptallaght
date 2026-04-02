const API_BASE = import.meta.env.DEV
  ? "/api"
  : "/api";

function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = import.meta.env.BASE_URL + "login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(password: string): Promise<string> {
  const data = await request<{ token: string }>("/admin/auth", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return data.token;
}

export async function getPosts(params: { status?: string; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  return request<{ posts: Post[]; pagination: Pagination }>(`/posts?${q}`);
}

export async function getPost(id: number) {
  return request<Post>(`/posts/${id}`);
}

export async function updatePost(id: number, data: Partial<Post>) {
  return request<Post>(`/posts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deletePost(id: number) {
  return request<void>(`/posts/${id}`, { method: "DELETE" });
}

export async function getStats() {
  return request<{ totalPublished: number; totalDraft: number; totalHeld: number; todayPublished: number }>("/posts/summary");
}

export async function getCategories() {
  return request<Category[]>("/categories");
}

export async function getSettings() {
  return request<Setting[]>("/admin/settings");
}

export async function updateSetting(key: string, value: string) {
  return request<Setting>(`/admin/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
}

export async function clearSetting(key: string) {
  return request<void>(`/admin/settings/${key}`, { method: "DELETE" });
}

export interface RssFeed {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
  checkIntervalMinutes: number;
  lastFetchedAt: string | null;
  createdAt: string;
}

export async function getRssFeeds() {
  return request<RssFeed[]>("/rss/feeds");
}

export async function createRssFeed(data: { name: string; url: string; checkIntervalMinutes?: number }) {
  return request<RssFeed>("/rss/feeds", { method: "POST", body: JSON.stringify(data) });
}

export async function updateRssFeed(id: number, data: Partial<Pick<RssFeed, "name" | "url" | "isActive" | "checkIntervalMinutes">>) {
  return request<RssFeed>(`/rss/feeds/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteRssFeed(id: number) {
  return request<void>(`/rss/feeds/${id}`, { method: "DELETE" });
}

export async function getGoldenExamples() {
  return request<GoldenExample[]>("/admin/golden-examples");
}

export async function createGoldenExample(postId: number, notes?: string) {
  return request<GoldenExample>("/admin/golden-examples", {
    method: "POST",
    body: JSON.stringify({ postId, notes }),
  });
}

export async function deleteGoldenExample(id: number) {
  return request<void>(`/admin/golden-examples/${id}`, { method: "DELETE" });
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  status: "draft" | "held" | "published" | "rejected";
  confidenceScore: string | null;
  wordCount: number | null;
  primaryCategoryId: number | null;
  isSponsored: boolean;
  isFeatured: boolean;
  starRating: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  colour: string | null;
}

export interface Setting {
  id: number;
  key: string;
  label: string;
  description: string | null;
  helpUrl: string | null;
  category: string;
  isSecret: boolean;
  isRequired: boolean;
  isConfigured: boolean;
  displayOrder: number;
  value: string | null;
}

export interface GoldenExample {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  inputText: string;
  outputText: string;
  notes: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface UsageByModel {
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface UsageByStage {
  stage: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface UsageDaySeries {
  day: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  submissions: number;
}

export interface UsageEntry {
  id: number;
  submissionId: number | null;
  jobId: number | null;
  model: string;
  stage: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string;
  createdAt: string;
}

export interface UsageData {
  totals: {
    today: UsageTotals;
    week: UsageTotals;
    month: UsageTotals;
    allTime: UsageTotals;
  };
  byModel: UsageByModel[];
  byStage: UsageByStage[];
  dailySeries: UsageDaySeries[];
  recentEntries: UsageEntry[];
}

export async function getUsage() {
  return request<UsageData>("/admin/usage");
}
