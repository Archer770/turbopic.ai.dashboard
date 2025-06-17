import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { useEffect, useState, useCallback } from "react"

import { AppSidebar } from "~/components/app-sidebar"
import { SiteHeader } from "~/components/site-header"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { ScrollArea } from "~/components/ui/scroll-area";
import { Trash2, PlusCircle } from "lucide-react";

import { toast } from "react-hot-toast";

import { Input } from "~/components/ui/input";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";

import { requireUser } from "~/utils/requireUser";
import { db } from "~/utils/db.server";

import { getAll639_1, getEnglishName, getNativeName } from "all-iso-language-codes"

import {
    getSettingsPayload,
    getConditions,
    getDescriptions
  } from "~/utils/settings.server";

import { getEffectivePermissions } from "~/utils/permissions.server";


interface ConditionGPT {
    id: string | number;
    title: string;
    message: string;
  }

  interface DescriptionGen {
    id: string | number;
    title: string;
    message: string;
    maxTextLength?: number;
    minTextLength?: number;
    maxTextLengthSimple?: number;
    minTextLengthSimple?: number;
  }
  
  interface Setting {
    generationMode?: string;
    messageTitle?: string;
    messageTags?: string;
    messageSeoTitle?: string;
    messageSeoDes?: string;
    messageDes?: string;
    maxDesLength?: number;
    minDesLength?: number;
    maxDesLengthSimple?: number;
    minDesLengthSimple?: number;
    locale?: string;
    localeDefault?: boolean;
  }
  
  interface LoaderData {
    conditions_gpt: ConditionGPT[];
    locales: { name: string }[];
    locales_primary: { name: string };
    description_Gen: DescriptionGen[];
    settings: Setting;
    permissions: {};
  }



export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cookie = request.headers.get("Cookie")
  const session = await sessionStorage.getSession(cookie)
  const token = session.get("token")

  const All639_1 = getAll639_1();
  
  const  locales: { name: string, native: string }[] = [];

  const seen = new Set<string>();

  All639_1.forEach((loc) => {
    const EnglishName = getEnglishName(loc);
    const NativeName = getNativeName(loc);
    if (typeof EnglishName === "string" && typeof NativeName === "string") {
      const lower = EnglishName.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        locales.push({ name: EnglishName, native: NativeName });
      }
    }
  });

  const  locales_primary: { name: string } = { name: '' }
 
  const [settings, conditions_gpt, description_Gen, permissions] = await Promise.all([
    getSettingsPayload(user.id),
    getConditions(user.id),
    getDescriptions(user.id),
    getEffectivePermissions(user.id),
  ]);

  

  console.log("📦 [dashboard.loader] Loaded user:", user);
  return new Response(JSON.stringify({ user, token, conditions_gpt, description_Gen, locales, locales_primary, settings, permissions }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie");
  const session = await sessionStorage.getSession(cookie);
  const token = session.get("token");

  if (token) {
    await db.session.delete({ where: { token } });
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}



 function Settings() {
    const {
      conditions_gpt,
      locales,
      locales_primary,
      description_Gen,
      settings,
      permissions
    } = useLoaderData<LoaderData>();
  
    const [generationMode, setGenerationMode] = useState(settings?.generationMode || "normal");
    const [messageTitle, setMessageTitle] = useState(settings?.messageTitle || "");
    const [messageTags, setMessageTags] = useState(settings?.messageTags || "");
    const [messageSeoTitle, setMessageSeoTitle] = useState(settings?.messageSeoTitle || "");
    const [messageSeoDes, setMessageSeoDes] = useState(settings?.messageSeoDes || "");
    const [settingsSaveStatus, setSettingsSaveStatus] = useState(false);

    const [conditions, setConditions] = useState<ConditionGPT[]>(conditions_gpt);
    const [selectedConditionId, setSelectedConditionId] = useState<string | number | null>(conditions_gpt[0]?.id || null);
    const [savingConditions, setSavingConditions] = useState(false);

    const selectedCondition = conditions.find(c => c.id === selectedConditionId);

    const [descriptionGen, setDescriptionGen] = useState<DescriptionGen[]>(description_Gen);
    const [selectedDescriptionId, setSelectedDescriptionId] = useState<string | number | null>(description_Gen[0]?.id || null);
    const selectedDescription = descriptionGen.find(d => d.id === selectedDescriptionId);
    const [savingDescriptionGen, setSavingDescriptionGen] = useState(false);

    const [maxDesLength, setMaxDesLength] = useState(settings?.maxDesLength || 0);
    const [minDesLength, setMinDesLength] = useState(settings?.minDesLength || 0);
    const [maxDesLengthSimple, setMaxDesLengthSimple] = useState(settings?.maxDesLengthSimple || 0);
    const [minDesLengthSimple, setMinDesLengthSimple] = useState(settings?.minDesLengthSimple || 0);
    const [messageDes, setMessageDes] = useState(settings?.messageDes || "");
    const [savingDefaults, setSavingDefaults] = useState(false);

    const [localeDefault, setLocaleDefault] = useState(settings?.localeDefault ?? true);
    const [selectedLocale, setSelectedLocale] = useState(settings?.locale || locales_primary?.name || 'English');
    const [localeSearch, setLocaleSearch] = useState("");
    const [savingLocale, setSavingLocale] = useState(false);

const updateSelectedDescription = <K extends keyof DescriptionGen>(
  key: K,
  value: DescriptionGen[K]
) => {
  setDescriptionGen(prev =>
    prev.map(d =>
      d.id === selectedDescriptionId ? { ...d, [key]: value } : d
    )
  );
};

const saveDescriptionGen = async () => {
  setSavingDescriptionGen(true);
  const formData = new FormData();
  formData.append("action", "update-descriptions-gen");

  descriptionGen.forEach(description => {
    const copy = { ...description };
    if (typeof copy.id === "string" && copy.id.startsWith("new")) {
      copy.id = "new";
    }
    if (copy.title || copy.message) {
      formData.append("description", JSON.stringify(copy));
    }
  });

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    setDescriptionGen(data);
    toast.success("Description rules saved");
  } catch (e) {
    toast.error("Failed to save descriptions");
  } finally {
    setSavingDescriptionGen(false);
  }
};

  
    const saveGenerationRules = async () => {
      setSettingsSaveStatus(true);
      const formData = new FormData();
      formData.append("action", "update-generation-rules");
      formData.append("settings-gen-rules", JSON.stringify({
        generationMode,
        messageTitle,
        messageTags,
        messageSeoTitle,
        messageSeoDes
      }));
  
      const res = await fetch("/api/settings", {
        method: "POST",
        body: formData
      });
  
      if (res.ok) {
        toast.success("Generation rules updated");
      } else {
        toast.error("Failed to update rules");
      }
      setSettingsSaveStatus(false);
    };

    const saveConditions = async () => {
        setSavingConditions(true);
        const formData = new FormData();
        formData.append("action", "update-conditions-gpt");
    
        conditions.forEach(cond => {
          const payload = { ...cond };
          if (typeof payload.id === 'string' && payload.id.startsWith('new')) {
            payload.id = 'new';
          }
          if (payload.title || payload.message) {
            formData.append('condition', JSON.stringify(payload));
          }
        });
    
        const res = await fetch("/api/settings", {
          method: "POST",
          body: formData
        });
    
        const data = await res.json();
        setConditions(data);
        setSavingConditions(false);
        toast.success("Conditions saved");
      };
    
      const updateSelectedCondition = (field: keyof ConditionGPT, value: string) => {
        setConditions(prev =>
          prev.map(cond =>
            cond.id === selectedConditionId ? { ...cond, [field]: value } : cond
          )
        );
      };
    
      const deleteCondition = (id: string | number) => {
        const updated = conditions.filter(c => c.id !== id);
        setConditions(updated);
        setSelectedConditionId(updated[0]?.id || null);
      };
    
      const addCondition = () => {
        const newId = 'new_' + Math.random().toString(36).slice(2);
        const newCondition = { id: newId, title: '', message: '' };
        setConditions(prev => [...prev, newCondition]);
        setSelectedConditionId(newId);
      };

      const saveDefaults = async () => {
        setSavingDefaults(true);
        const formData = new FormData();
        formData.append("action", "update-description-def");
        formData.append("settings-desc", JSON.stringify({
          maxDesLength,
          minDesLength,
          maxDesLengthSimple,
          minDesLengthSimple,
          messageDes
        }));
      
        try {
          const res = await fetch("/api/settings", {
            method: "POST",
            body: formData
          });
          await res.json();
          toast.success("Default description rules saved");
        } catch (e) {
          toast.error("Failed to save defaults");
        } finally {
          setSavingDefaults(false);
        }
      };

      const filteredLocales = locales.filter(locale =>
        locale.name.toLowerCase().includes(localeSearch.toLowerCase()) || locale.native.toLowerCase().includes(localeSearch.toLowerCase())
      );
      
      const saveLocale = async () => {
        setSavingLocale(true);
        const formData = new FormData();
        formData.append("action", "update-language");
        formData.append("locale", selectedLocale);
        formData.append("localeDefault", localeDefault ? "true" : "false");
      
        try {
          const res = await fetch("/api/settings", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          toast.success(localeDefault
            ? `Default language set to ${locales_primary.name}`
            : `${data.locale} language set successfully`
          );
        } catch (e) {
          toast.error("Failed to save locale");
        } finally {
          setSavingLocale(false);
        }
      };

      const disabled_language_change = Boolean(!Boolean(permissions.language) || permissions?.language != 'language:change:true');
      const disabled_settings_fields = Boolean(!Boolean(permissions.settings) || permissions?.settings != 'settings:fields:true');
  
    return (
      <div className="p-4 space-y-8">
        <Tabs defaultValue="generation" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="generation">Generation Rules</TabsTrigger>
            <TabsTrigger value="conditions">GPT Rules</TabsTrigger>
            <TabsTrigger value="description">Description Rules</TabsTrigger>
            <TabsTrigger value="language">Language</TabsTrigger>
          </TabsList>
  
          <TabsContent value="generation">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle>Generation Rules</CardTitle>
                <CardDescription>Configure how product descriptions are generated</CardDescription>
                </div>
                <Button
                  onClick={saveGenerationRules}
                  disabled={settingsSaveStatus || disabled_settings_fields}
                >
                  {settingsSaveStatus ? "Saving..." : "Save"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Generation Mode</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={generationMode === "simplified" ? "default" : "outline"}
                      onClick={() => setGenerationMode("simplified")}
                      disabled={disabled_settings_fields}
                    >
                      Simplified
                    </Button>
                    <Button
                      variant={generationMode === "normal" ? "default" : "outline"}
                      onClick={() => setGenerationMode("normal")}
                      disabled={disabled_settings_fields}
                    >
                      Normal
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="messageTitle">For Title</Label>
                  <Textarea id="messageTitle" value={messageTitle} onChange={e => setMessageTitle(e.target.value)} disabled={disabled_settings_fields} />
                </div>
                <div>
                  <Label htmlFor="messageTags">For Tags</Label>
                  <Textarea id="messageTags" value={messageTags} onChange={e => setMessageTags(e.target.value)} disabled={disabled_settings_fields} />
                </div>
                <div>
                  <Label htmlFor="messageSeoTitle">For SEO Title</Label>
                  <Textarea id="messageSeoTitle" value={messageSeoTitle} onChange={e => setMessageSeoTitle(e.target.value)} disabled={disabled_settings_fields} />
                </div>
                <div>
                  <Label htmlFor="messageSeoDes">For SEO Description</Label>
                  <Textarea id="messageSeoDes" value={messageSeoDes} onChange={e => setMessageSeoDes(e.target.value)} disabled={disabled_settings_fields} />
                </div>
                
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
              <CardTitle>Additional GPT Rules</CardTitle>
              <CardDescription>Manage predefined prompts for product generation</CardDescription>
              </div>
              <Button onClick={saveConditions} disabled={savingConditions || disabled_settings_fields}>
                  {savingConditions ? "Saving..." : "Save"}
                </Button>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="w-1/3">
                <ScrollArea className="h-64 border rounded-md">
                  {conditions.map(cond => (
                    <div
                      key={cond.id}
                      className={`cursor-pointer p-2 border-b hover:bg-muted ${selectedConditionId === cond.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedConditionId(cond.id)}
                    >
                      {cond.title || cond.id}
                    </div>
                  ))}
                </ScrollArea>
                <Button variant="outline" className="mt-2 w-full" onClick={addCondition} disabled={disabled_settings_fields}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New
                </Button>
              </div>
              <div className="w-2/3 space-y-4">
                {selectedCondition && (
                  <>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="cond-title">Title</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCondition(selectedCondition.id)}
                        disabled={disabled_settings_fields}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <Input
                      id="cond-title"
                      value={selectedCondition.title}
                      onChange={e => updateSelectedCondition("title", e.target.value)}
                      disabled={disabled_settings_fields}
                    />
                    <Label htmlFor="cond-msg">Message</Label>
                    <Textarea
                      id="cond-msg"
                      rows={6}
                      value={selectedCondition.message}
                      onChange={e => updateSelectedCondition("message", e.target.value)}
                      disabled={disabled_settings_fields}
                    />
                  </>
                )}
                
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="description" className="flex flex-col gap-4">
                
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
              <CardTitle>Default Description Rules</CardTitle>
              <CardDescription>Settings applied when no custom rules are defined</CardDescription>
              </div>
              <Button onClick={saveDefaults} disabled={savingDefaults || disabled_settings_fields}>
                {savingDefaults ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                  <Label htmlFor="minDesLength">Min Length</Label>
                  <Input
                    id="minDesLength"
                    type="number"
                    value={minDesLength}
                    onChange={e => setMinDesLength(Number(e.target.value))}
                    disabled={disabled_settings_fields}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDesLength">Max Length</Label>
                  <Input
                    id="maxDesLength"
                    type="number"
                    value={maxDesLength}
                    onChange={e => setMaxDesLength(Number(e.target.value))}
                    disabled={disabled_settings_fields}
                  />
                </div>
                <div>
                  <Label htmlFor="minDesLengthSimple">Simple Min Length</Label>
                  <Input
                    id="minDesLengthSimple"
                    type="number"
                    value={minDesLengthSimple}
                    onChange={e => setMinDesLengthSimple(Number(e.target.value))}
                    disabled={disabled_settings_fields}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDesLengthSimple">Simple Max Length</Label>
                  <Input
                    id="maxDesLengthSimple"
                    type="number"
                    value={maxDesLengthSimple}
                    onChange={e => setMaxDesLengthSimple(Number(e.target.value))}
                    disabled={disabled_settings_fields}
                  />
                </div>
                
              </div>
              <div>
                <Label htmlFor="messageDes">Fallback Message</Label>
                <Textarea
                  id="messageDes"
                  rows={4}
                  value={messageDes}
                  onChange={e => setMessageDes(e.target.value)}
                  disabled={disabled_settings_fields}
                />
              </div>
              
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
              <CardTitle>Description Generation Rules</CardTitle>
              <CardDescription>Specify custom rules for different generation presets</CardDescription>
              </div>
              <Button onClick={saveDescriptionGen} disabled={savingDescriptionGen || disabled_settings_fields}>
                  {savingDescriptionGen ? "Saving..." : "Save"}
                </Button>
            </CardHeader>
            <CardContent className="flex gap-4">
              {/* LEFT LIST */}
              <div className="w-1/3">
                <ScrollArea className="h-72 border rounded-md">
                  {description_Gen.map(desc => (
                    <div
                      key={desc.id}
                      className="cursor-pointer p-2 border-b hover:bg-muted"
                      onClick={() => setSelectedDescriptionId(desc.id)}
                      
                    >
                      {desc.title || desc.id}
                    </div>
                  ))}
                </ScrollArea>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    const newId = "new_" + Math.random().toString(36).substring(2);
                    setDescriptionGen(prev => [...prev, { id: newId, title: "", message: "" }]);
                    setSelectedDescriptionId(newId);
                  }}
                  disabled={disabled_settings_fields}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New
                </Button>
              </div>

              {/* RIGHT FORM */}
              <div className="w-2/3 space-y-4">
                {selectedDescription && (
                  <>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="desc-title">Title</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDescriptionGen(prev => prev.filter(d => d.id !== selectedDescriptionId));
                          setSelectedDescriptionId(null);
                        }}
                        disabled={disabled_settings_fields}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <Input
                      id="desc-title"
                      value={selectedDescription.title}
                      onChange={e => updateSelectedDescription("title", e.target.value)}
                      disabled={disabled_settings_fields}
                    />
                    <Label htmlFor="desc-msg">Message</Label>
                    <Textarea
                      id="desc-msg"
                      rows={6}
                      value={selectedDescription.message}
                      onChange={e => updateSelectedDescription("message", e.target.value)}
                      disabled={disabled_settings_fields}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                      <Label>Min Length</Label>
                      <Input
                        type="number"
                        placeholder="Min Len"
                        value={String(selectedDescription.minTextLength || 0)}
                        onChange={e => updateSelectedDescription("minTextLength", parseInt(e.target.value) || 0)}
                        disabled={disabled_settings_fields}
                      />
                      </div>
                      <div>
                      <Label>Max Length</Label>  
                      <Input
                        type="number"
                        placeholder="Max Len"
                        value={String(selectedDescription.maxTextLength || 0)}
                        onChange={e => updateSelectedDescription("maxTextLength", parseInt(e.target.value) || 0)}
                        disabled={disabled_settings_fields}
                      />
                      </div>
                      <div>
                      <Label>Simple Min Length</Label>
                      <Input
                        type="number"
                        placeholder="Simple Min"
                        value={String(selectedDescription.minTextLengthSimple || 0)}
                        onChange={e => updateSelectedDescription("minTextLengthSimple", parseInt(e.target.value) || 0)}
                        disabled={disabled_settings_fields}
                      />
                      </div>
                      <div>
                      <Label>Simple Max Length</Label>
                      <Input
                        type="number"
                        placeholder="Simple Max"
                        value={String(selectedDescription.maxTextLengthSimple || 0)}
                        onChange={e => updateSelectedDescription("maxTextLengthSimple", parseInt(e.target.value) || 0)}
                        disabled={disabled_settings_fields}
                      />
                      </div>
                    </div>
                  </>
                )}
                
              </div>
            </CardContent>
          </Card>
        
          
        </TabsContent>

        <TabsContent value="language">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Product Language</CardTitle>
              <CardDescription>Select the language used for generating product content</CardDescription>
            </div>
            <Button onClick={saveLocale} disabled={savingLocale || disabled_language_change}>
                {savingLocale ? "Saving..." : "Save"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">

              <div>
                <Label htmlFor="localeSearch">Search Locales</Label>
                <Input
                  id="localeSearch"
                  placeholder={selectedLocale}
                  value={localeSearch}
                  onChange={e => setLocaleSearch(e.target.value)}
                  disabled={disabled_language_change}
                />
              </div>

              <ScrollArea className="h-48 border rounded-md" >
                <div className="flex flex-col gap-1 p-2">
                  {filteredLocales.map(locale => (
                    <Button
                      key={locale.name}
                      variant={selectedLocale === locale.name ? "default" : "ghost"}
                      className="justify-start"
                      onClick={() => setSelectedLocale(locale.name)}
                      disabled={disabled_language_change}
                    >
                      {locale.name} ({locale.native})
                    </Button>
                  ))}
                </div>
              </ScrollArea>

              
            </CardContent>
          </Card>
        </TabsContent>

        </Tabs>
      </div>
    );
  }  


export default function SettingsPage() {

  const data = useLoaderData<{ user: { name?: string; email: string; avatar: string; avatarf: string }, token:string }>();
  data.user.avatarf = '..';

  

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar user={data.user} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <Settings/>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}