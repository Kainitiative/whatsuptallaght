import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CategoryFilter } from "@/components/category-filter";
import { BarChart3, Users, Target, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Advertise() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Enquiry Sent",
        description: "Thank you. Our team will contact you shortly about advertising opportunities.",
      });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col bg-background pb-20">
      <CategoryFilter />
      
      {/* Header */}
      <section className="bg-accent text-accent-foreground py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 drop-shadow-sm">Reach the Tallaght Community</h1>
          <p className="text-xl opacity-90 leading-relaxed font-medium">
            Connect your business directly with local residents. Tallaght Platform offers authentic, hyper-local advertising that people actually see.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Info Side */}
          <div className="flex flex-col gap-10">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-foreground">Why advertise with us?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Traditional local newspapers are dying, and social media algorithms hide your posts. Tallaght Platform is the new digital noticeboard that residents check daily.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-border shadow-sm">
                  <CardContent className="p-6">
                    <Target className="w-8 h-8 text-primary mb-4" />
                    <h3 className="font-bold text-lg mb-2">Hyper-Targeted</h3>
                    <p className="text-muted-foreground text-sm">Every reader is a local resident. No wasted spend on out-of-area clicks.</p>
                  </CardContent>
                </Card>
                <Card className="border-border shadow-sm">
                  <CardContent className="p-6">
                    <Users className="w-8 h-8 text-secondary mb-4" />
                    <h3 className="font-bold text-lg mb-2">Community Trust</h3>
                    <p className="text-muted-foreground text-sm">Align your brand with a positive, community-driven platform.</p>
                  </CardContent>
                </Card>
                <Card className="border-border shadow-sm">
                  <CardContent className="p-6">
                    <BarChart3 className="w-8 h-8 text-accent mb-4" />
                    <h3 className="font-bold text-lg mb-2">Clear Metrics</h3>
                    <p className="text-muted-foreground text-sm">Transparent reporting on views, clicks, and engagement for every campaign.</p>
                  </CardContent>
                </Card>
                <Card className="border-border shadow-sm">
                  <CardContent className="p-6">
                    <Megaphone className="w-8 h-8 text-[#f59e0b] mb-4" />
                    <h3 className="font-bold text-lg mb-2">Native Formats</h3>
                    <p className="text-muted-foreground text-sm">Sponsored articles that blend seamlessly with our reading experience.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-6 text-foreground">Advertising Options</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-4 p-4 rounded-xl bg-card border">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></div>
                  <div>
                    <h4 className="font-bold text-lg">Sponsored Articles</h4>
                    <p className="text-muted-foreground text-sm mt-1">Full-length feature articles about your business, written professionally and pinned to the homepage.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 rounded-xl bg-card border">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2 shrink-0"></div>
                  <div>
                    <h4 className="font-bold text-lg">Display Banners</h4>
                    <p className="text-muted-foreground text-sm mt-1">High-visibility banner placements within the article feed and on reading pages.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 rounded-xl bg-card border">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b] mt-2 shrink-0"></div>
                  <div>
                    <h4 className="font-bold text-lg">Local Directory Listing</h4>
                    <p className="text-muted-foreground text-sm mt-1">Premium placement in our upcoming Local Business Services directory.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <Card className="border-border shadow-md bg-card sticky top-24">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-foreground">Get a Media Kit</h3>
                <p className="text-muted-foreground mb-8">Fill out the form below and our partnerships team will send you our current rates and audience stats.</p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" required placeholder="Jane Doe" className="bg-background" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="business">Business Name</Label>
                    <Input id="business" required placeholder="Jane's Cafe" className="bg-background" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" required placeholder="jane@example.com" className="bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" placeholder="087..." className="bg-background" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="interest">What are you interested in?</Label>
                    <select 
                      id="interest" 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    >
                      <option value="" disabled selected>Select an option...</option>
                      <option value="sponsored">Sponsored Articles</option>
                      <option value="banners">Display Banners</option>
                      <option value="directory">Local Directory</option>
                      <option value="other">Other / Not Sure</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message (Optional)</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Tell us a bit about your marketing goals..." 
                      className="min-h-[100px] bg-background"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg font-bold rounded-full" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Request Media Kit"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
