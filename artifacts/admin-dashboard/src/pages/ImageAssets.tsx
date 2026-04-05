import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getImageAssets, deleteImageAsset, type ImageAsset } from "@/lib/api";
import { Trash2, ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TONE_COLORS: Record<string, string> = {
  news: "bg-blue-100 text-blue-800",
  event: "bg-purple-100 text-purple-800",
  sport: "bg-green-100 text-green-800",
  community: "bg-yellow-100 text-yellow-800",
  business: "bg-orange-100 text-orange-800",
  warning: "bg-red-100 text-red-800",
  memorial: "bg-gray-100 text-gray-800",
  other: "bg-slate-100 text-slate-800",
};

export default function ImageAssets() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["image-assets"],
    queryFn: getImageAssets,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImageAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image-assets"] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ImageIcon className="w-6 h-6" />
            Header Image Library
          </h1>
          <p className="text-muted-foreground mt-1">
            DALL·E generated header images, reused across similar articles to reduce API costs.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">{assets?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">total assets</p>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <Skeleton className="w-full aspect-video" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!assets || assets.length === 0) && (
        <div className="text-center py-20 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No header images yet</p>
          <p className="text-sm mt-1">
            Images appear here once articles are auto-published with image generation enabled.
          </p>
        </div>
      )}

      {!isLoading && assets && assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset: ImageAsset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-border overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: "16/9" }}>
                <img
                  src={asset.imageUrl}
                  alt={asset.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      TONE_COLORS[asset.tone] ?? TONE_COLORS.other
                    }`}
                  >
                    {asset.tone}
                  </span>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    Used {asset.usageCount}×
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                  {asset.prompt}
                </p>

                {asset.keywords && asset.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {asset.keywords.slice(0, 4).map((kw: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs py-0">
                        {kw}
                      </Badge>
                    ))}
                    {asset.keywords.length > 4 && (
                      <Badge variant="secondary" className="text-xs py-0">
                        +{asset.keywords.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(asset.createdAt).toLocaleDateString("en-IE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  {confirmDelete === asset.id ? (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => deleteMutation.mutate(asset.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(asset.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
