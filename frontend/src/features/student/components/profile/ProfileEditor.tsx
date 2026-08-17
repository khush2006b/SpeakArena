"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useStudentProfileStore } from "@/stores/student-profile.store";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

export function ProfileEditor() {
  const { isEditingProfile, setIsEditingProfile, avatarUploadPreview, setAvatarUploadPreview } = useStudentProfileStore();
  const [profile, setProfile] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isEditingProfile) {
      const fetchProfile = async () => {
        setIsLoading(true);
        try {
          const res = await apiClient.get('/api/v1/profile');
          const data = res.data?.data || res.data || res;
          setProfile({
            fullName: data.full_name || '',
            bio: data.bio || '',
            country: data.country || '',
            language: data.language || '',
            avatarUrl: data.avatar_url || ''
          });
        } catch (error) {
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    }
  }, [isEditingProfile]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUploadPreview(url);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await apiClient.patch('/api/v1/profile', {
        full_name: profile.fullName,
        bio: profile.bio,
        country: profile.country,
        language: profile.language,
      });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
      <DialogContent className="max-w-[500px] p-0 overflow-hidden card-glass border-border/50 rounded-2xl backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-foreground font-extrabold">Edit Profile</DialogTitle>
        </DialogHeader>

        {isLoading || !profile ? (
          <div className="px-6 pb-6 flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : (
          <div className="px-6 pb-6 flex flex-col gap-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-background">
                  <AvatarImage src={avatarUploadPreview || profile.avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-white/5 text-foreground font-bold">
                    {profile.fullName?.substring(0, 2).toUpperCase() || 'SA'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white cursor-pointer rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="mb-1" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} />
                </label>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Click to upload new photo</p>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">Full Name</Label>
                <Input 
                  id="name" 
                  value={profile.fullName} 
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="input-glass" 
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="bio" className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={3}
                  className="resize-none bg-background border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="country" className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">Country</Label>
                  <Input 
                    id="country" 
                    value={profile.country} 
                    onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                    className="input-glass" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="language" className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">Language</Label>
                  <Input 
                    id="language" 
                    value={profile.language} 
                    onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                    className="input-glass" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 flex justify-end gap-3 bg-white/[0.02] border-t border-border/50">
          <button className="btn-ghost press-scale" onClick={() => setIsEditingProfile(false)} disabled={isSaving}>Cancel</button>
          <button className="btn-primary press-scale" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
