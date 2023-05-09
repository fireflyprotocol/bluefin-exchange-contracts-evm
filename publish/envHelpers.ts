//Helper Functions For processing Env Variables

export const processEnvString = (address: string | undefined) =>
    address ? address : "";

export const processEnvAddress = (address: string | undefined) =>
    address
        ? [address]
        : ["1974562c46d665abae4a0b5871fca7468e5b30cf0ac3d857811a5f6d22a59c1c"];

export const processEnvRpcURL = (url: string | undefined) => (url ? url : "");
