// components/Sidebar.tsx
import Link from 'next/link';

const Sidebar = () => {
  return (
    <aside className="w-40 bg-gray-800 text-white p-4 space-y-2 h-screen">
      <h1 className="text-2xl font-semibold mb-4">VWAP-α</h1>
      <nav>
        <ul>
          <li>
            <Link href="/" legacyBehavior>
              <a className="block py-2 px-3 rounded hover:bg-gray-700">
                Projects
              </a>
            </Link>
          </li>
          <li>
            <Link href="/database-management" legacyBehavior>
              <a className="block py-2 px-3 rounded hover:bg-gray-700">
                Database
              </a>
            </Link>
          </li>
          {/* 今後他の項目が増えたらここに追加 */}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;