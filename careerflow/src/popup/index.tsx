import { useState } from "react"
import "./popup.css"
import { ProfileTab } from "./profile/ProfileTab"
import { DashboardTab } from "./dashboard/DashboardTab"
import { SettingsTab } from "./settings/SettingsTab"

function IndexPopup() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "settings">("profile")

  return (
    <div className="w-[400px] min-h-[600px] bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3">
        <h1 className="text-xl font-bold">Knight</h1>
        <p className="text-xs text-blue-100">Universal Job Application Tracker</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {(["dashboard", "profile", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
{activeTab === "dashboard" && <DashboardTab />}

      {activeTab === "profile" && <ProfileTab />}

      {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  )
}

export default IndexPopup
