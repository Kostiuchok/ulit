import { ProfileTabs } from "../../../components/dashboard/ProfileTabs";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <ProfileTabs />
      {children}
    </div>
  );
}
