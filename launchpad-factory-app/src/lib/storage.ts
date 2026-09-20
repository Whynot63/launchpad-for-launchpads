import { AwsClient } from "aws4fetch";

const client = new AwsClient({
  accessKeyId: process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  region: process.env.S3_REGION,
  service: "s3",
});

const objectUrl = (key: string) => {
  const endpoint = new URL(process.env.S3_ENDPOINT!);
  return process.env.S3_FORCE_PATH_STYLE === "true"
    ? `${endpoint.origin}/${process.env.S3_BUCKET}/${key}`
    : `${endpoint.protocol}//${process.env.S3_BUCKET}.${endpoint.host}/${key}`;
};

export const putObject = async (key: string, body: ArrayBuffer, contentType: string) => {
  const signed = await client.sign(objectUrl(key), { method: "PUT", body, headers: { "content-type": contentType } });
  const response = await fetch(signed.url, { method: "PUT", body, headers: signed.headers });
  if (!response.ok) throw new Error(`Storage upload failed with status ${response.status}: ${await response.text()}`);
};

export const getObject = (key: string) => client.fetch(objectUrl(key));
