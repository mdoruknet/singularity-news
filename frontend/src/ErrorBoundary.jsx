import { Component } from "react";

/**
 * Uygulama genelinde render hatalarını yakalayan sınır (Error Boundary).
 * Tek bir bileşendeki beklenmeyen hata tüm uygulamayı "beyaz ekran"a
 * düşürmesin diye; bunun yerine markalı, kurtarılabilir bir ekran gösterir.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Harici hata servisi yok; teşhis için konsola yaz.
    console.error("Singularity arayüz hatası:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-5 bg-white px-6 text-center dark:bg-neutral-950">
        <p className="font-logo text-4xl leading-none text-black dark:text-white">
          Singularity
        </p>
        <h1 className="font-display text-2xl font-bold text-black dark:text-white">
          Bir şeyler ters gitti
        </h1>
        <p className="max-w-sm font-serif text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
          Arayüzde beklenmeyen bir hata oluştu. Sayfayı yeniden yükleyerek
          kaldığınız yerden devam edebilirsiniz.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 border border-black px-5 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-black transition hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
        >
          Yeniden Yükle
        </button>
      </div>
    );
  }
}
