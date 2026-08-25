import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is well under a typical phone camera photo (often
      // 3-12MB); uploadMemberPhotoAction/removeMemberPhotoAction send the
      // raw file as multipart form data straight to this Server Action.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
