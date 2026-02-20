import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { QueryClientProvider } from "@/components/QueryClientProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
    title: "TAV Eğitim Paneli",
    description: "Havalimanı Personel Eğitim Takip Sistemi",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr" suppressHydrationWarning={true}>
            <body className="antialiased" suppressHydrationWarning={true}>
                <ErrorBoundary>
                    <QueryClientProvider>
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </QueryClientProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
