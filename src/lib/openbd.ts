interface OpenBDResponse {
  summary?: {
    cover?: string;
  };
}

async function fetchFromOpenBD(
  isbns: string[]
): Promise<Map<string, string>> {
  const coverMap = new Map<string, string>();
  if (isbns.length === 0) return coverMap;

  try {
    const response = await fetch(
      `https://api.openbd.jp/v1/get?isbn=${isbns.join(",")}`
    );
    const data: (OpenBDResponse | null)[] = await response.json();

    data.forEach((item, index) => {
      const cover = item?.summary?.cover;
      if (cover) {
        coverMap.set(isbns[index], cover);
      }
    });
  } catch (error) {
    console.warn("OpenBD API request failed:", error);
  }

  return coverMap;
}

export async function fetchCoverUrls(
  isbns: string[]
): Promise<Map<string, string>> {
  // Try OpenBD (batch request, may have higher-res covers)
  return await fetchFromOpenBD(isbns);
}
