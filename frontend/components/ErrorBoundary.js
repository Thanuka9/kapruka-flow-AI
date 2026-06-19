import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to the console; in production this is where you'd ship to Sentry.
    console.error("Kapruka Flow UI crashed:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#01091a] text-slate-100 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#c70101]/15 border border-[#c70101]/40 flex items-center justify-center text-3xl mb-5">
          ⚠️
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">Something went wrong</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          The shopping experience hit an unexpected error. Your session is safe — reload to continue.
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="btn-premium px-6 py-3 text-sm font-bold"
        >
          Reload Kapruka Flow
        </button>
      </div>
    );
  }
}
