export default {
  async fetch(request, environment) {
    const response = await environment.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml || request.method !== "GET") return response;

    const fallbackUrl = new URL("/index.html", request.url);
    return environment.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
