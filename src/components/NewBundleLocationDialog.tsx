import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface NewBundleLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedLocation: string | null;
  allLocationsOccupied: boolean;
  onConfirm: (location: string) => void;
}

export function NewBundleLocationDialog({
  open,
  onOpenChange,
  suggestedLocation,
  allLocationsOccupied,
  onConfirm
}: NewBundleLocationDialogProps) {
  const [useCustom, setUseCustom] = useState(false);
  const [customLocation, setCustomLocation] = useState('');

  const handleConfirm = () => {
    const location = useCustom ? customLocation : suggestedLocation;
    if (location) {
      onConfirm(location);
      setUseCustom(false);
      setCustomLocation('');
    }
  };

  const handleCancel = () => {
    setUseCustom(false);
    setCustomLocation('');
    onOpenChange(false);
  };

  if (allLocationsOccupied) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              All Locations Occupied
            </DialogTitle>
            <DialogDescription>
              All bundle staging locations are currently in use. Please wait for a bundle to complete or enter a custom location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-loc">Custom Location</Label>
              <Input
                id="custom-loc"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter a temporary location..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!customLocation.trim()}
            >
              Use Custom Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            NEW BUNDLE - Suggested Location
          </DialogTitle>
          <DialogDescription>
            This is the first device in a new bundle. Place all devices at the location below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6">
          {!useCustom ? (
            <>
              <div className="text-lg text-muted-foreground mb-2">Place devices at</div>
              <div className="text-7xl font-bold text-primary tracking-wider py-4 px-8 rounded-lg bg-primary/10 border-2 border-primary transition-all duration-300">
                {suggestedLocation}
              </div>
              <div className="text-sm text-muted-foreground mt-4">
                This location is currently available
              </div>
            </>
          ) : (
            <div className="w-full space-y-2">
              <Label htmlFor="custom-location">Enter Custom Location</Label>
              <Input
                id="custom-location"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter location..."
                className="text-2xl h-14 text-center font-mono"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!useCustom ? (
            <>
              <Button variant="outline" onClick={() => setUseCustom(true)}>
                Use Different Location
              </Button>
              <Button onClick={handleConfirm} size="lg" className="min-w-[200px]">
                <MapPin className="h-5 w-5 mr-2" />
                Confirm Location {suggestedLocation}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setUseCustom(false)}>
                Back to Suggested
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!customLocation.trim()}
                size="lg"
              >
                Use {customLocation || 'Custom'} Location
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
