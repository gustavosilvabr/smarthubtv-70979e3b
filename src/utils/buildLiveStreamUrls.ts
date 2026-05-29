export function buildLiveStreamUrls(
  server: string,
  username: string,
  password: string,
  streamId: string | number,
) {
  const cleanServer = server.replace(/\/$/, "");

  return {
    hls: `${cleanServer}/live/${username}/${password}/${streamId}.m3u8`,
    ts: `${cleanServer}/live/${username}/${password}/${streamId}.ts`,
  };
}