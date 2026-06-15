"use client";

import {
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { isEnokiNetwork, registerEnokiWallets } from "@mysten/enoki";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  enokiClientConfig,
  getEnokiRedirectUrl,
  isEnokiClientConfigured,
} from "~/lib/enoki/config";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

const networkConfig =
  typeof window !== "undefined"
    ? createNetworkConfig({
        devnet: {
          network: "devnet",
          url: getJsonRpcFullnodeUrl("devnet"),
        },
        testnet: {
          network: "testnet",
          url:
            enokiClientConfig.network === "testnet"
              ? enokiClientConfig.fullnodeUrl
              : getJsonRpcFullnodeUrl("testnet"),
        },
        mainnet: {
          network: "mainnet",
          url:
            enokiClientConfig.network === "mainnet"
              ? enokiClientConfig.fullnodeUrl
              : getJsonRpcFullnodeUrl("mainnet"),
        },
      }).networkConfig
    : ({} as ReturnType<typeof createNetworkConfig>["networkConfig"]);

function RegisterEnokiWallets() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    if (!isEnokiNetwork(network)) return;
    if (!isEnokiClientConfigured()) return;

    const { unregister } = registerEnokiWallets({
      apiKey: enokiClientConfig.enokiApiKey,
      client,
      network,
      providers: {
        google: {
          clientId: enokiClientConfig.googleClientId,
          redirectUrl: getEnokiRedirectUrl(),
          extraParams: {
            scope: "openid email profile",
          },
        },
      },
    });

    return unregister;
  }, [client, network]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="loading-screen">
        <span className="pulse" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork={enokiClientConfig.network}
      >
        <RegisterEnokiWallets />
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
