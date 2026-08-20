jest.mock("next/server", () => ({
  NextResponse: {
    redirect: (url: URL) => ({
      headers: new Headers({ location: url.toString() }),
    }),
  },
}));

import { GET } from "@/app/auth/callback/route";

function makeRequest(url: string) {
  return {
    nextUrl: new URL(url),
  };
}

describe("GET /auth/callback", () => {
  it("redirects email verification callbacks to the site root", async () => {
    const res = await GET(makeRequest("https://igndigitalmedia.web.app/auth/callback?next=%2Flogin%3Fverified%3Dsuccess%26reason%3Dstudent_email_verified") as never);

    expect(res.headers.get("location")).toBe("https://igndigitalmedia.web.app/");
  });
});
