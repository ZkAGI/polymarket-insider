export default function HomePage() {
  return (
    <main className="p-8 font-sans">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Polymarket Tracker</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
        Track and analyze whale trades and insider activity on Polymarket prediction markets.
      </p>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Features</h2>
        <ul className="space-y-2">
          <li className="flex items-center text-emerald-600 dark:text-emerald-400">
            <span className="mr-2">🐋</span>
            Real-time whale trade detection
          </li>
          <li className="flex items-center text-amber-600 dark:text-amber-400">
            <span className="mr-2">🔍</span>
            Insider activity monitoring
          </li>
          <li className="flex items-center text-blue-600 dark:text-blue-400">
            <span className="mr-2">📊</span>
            Market analytics and insights
          </li>
          <li className="flex items-center text-blue-600 dark:text-blue-400">
            <span className="mr-2">🔔</span>
            Price movement alerts
          </li>
        </ul>
      </section>
    </main>
  );
}
