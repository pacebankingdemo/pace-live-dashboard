import { createHmac, createHash } from "crypto";

const URL_EXPIRY_SECONDS = 900; // 15 minutes

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function sha256hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Generate a presigned S3 GET URL using raw SigV4 — no AWS SDK, no extra params.
 * This avoids @aws-sdk/s3-request-presigner injecting X-Amz-Content-Sha256=UNSIGNED-PAYLOAD
 * which causes SignatureDoesNotMatch when the param is stripped post-signing.
 */
function presignS3GetUrl({ accessKeyId, secretAccessKey, region, bucket, key, expiresIn }) {
  const now = new Date();
  const datestamp = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const amzdate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z"; // YYYYMMDDTHHmmssZ

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri = `/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
  const credentialScope = `${datestamp}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  // Canonical query string — must be sorted alphabetically
  const queryParams = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzdate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    queryParams,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzdate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  // Derive signing key
  const kDate    = hmac(Buffer.from("AWS4" + secretAccessKey, "utf8"), datestamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");

  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `https://${host}${canonicalUri}?${queryParams}&X-Amz-Signature=${signature}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = req.query.key;
  if (!key) return res.status(400).json({ error: "Missing 'key' query parameter" });
  if (!key.endsWith(".mp4") && !key.endsWith(".webm"))
    return res.status(400).json({ error: "Invalid key format" });

  const accessKeyId     = process.env.AWS_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;
  const region          = process.env.AWS_S3_REGION || "us-east-1";
  const bucket          = process.env.AWS_S3_BUCKET  || "zamp-prd-us-selenium-grid-bucket";

  if (!accessKeyId || !secretAccessKey) {
    return res.status(500).json({ error: "AWS credentials not configured" });
  }

  try {
    const url = presignS3GetUrl({ accessKeyId, secretAccessKey, region, bucket, key, expiresIn: URL_EXPIRY_SECONDS });
    return res.status(200).json({ url, expires_in: URL_EXPIRY_SECONDS });
  } catch (err) {
    console.error("Failed to generate pre-signed URL:", err.message);
    return res.status(500).json({ error: "Failed to generate video URL", detail: err.message });
  }
}
