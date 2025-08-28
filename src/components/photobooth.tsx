"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Sparkles, Camera, Download, RotateCcw, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Step = 'welcome' | 'selection' | 'capture' | 'collage';
type Layout = 'side-by-side' | 'up-and-down' | '2x2-grid';

const PhotoBooth: FC = () => {
  const [step, setStep] = useState<Step>('welcome');
  const [numPhotos, setNumPhotos] = useState<string>('2');
  const [layout, setLayout] = useState<Layout>('side-by-side');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [finalCollage, setFinalCollage] = useState<string | null>(null);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const collageCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startWebcam = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsWebcamReady(true);
          };
        }
      } else {
        throw new Error('getUserMedia not supported');
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      toast({
        variant: 'destructive',
        title: "Oh no! Webcam Error",
        description: "Couldn't access your camera. Please check permissions and try again.",
      });
      setStep('welcome');
    }
  }, [toast]);
  
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsWebcamReady(false);
  }, []);

  useEffect(() => {
    if (step === 'capture' && !isWebcamReady) {
      startWebcam();
    }
    if (step !== 'capture' && isWebcamReady) {
      stopWebcam();
    }
  }, [step, isWebcamReady, startWebcam, stopWebcam]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  const handleCapture = useCallback(() => {
    if (videoRef.current && photoCanvasRef.current && capturedPhotos.length < parseInt(numPhotos)) {
      const video = videoRef.current;
      const canvas = photoCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedPhotos(prev => [...prev, dataUrl]);
      }
    }
  }, [capturedPhotos.length, numPhotos]);
  
  const generateCollage = useCallback(async () => {
    const collageCanvas = collageCanvasRef.current;
    if (!collageCanvas || capturedPhotos.length === 0) return;
    const ctx = collageCanvas.getContext('2d');
    if (!ctx) return;

    const num = parseInt(numPhotos);
    
    // Layout parameters
    const layouts = {
        '2_side-by-side': { cols: 2, rows: 1, w: 1400, h: 800 },
        '2_up-and-down':  { cols: 1, rows: 2, w: 800, h: 1400 },
        '3_side-by-side': { cols: 3, rows: 1, w: 2000, h: 800 },
        '4_side-by-side': { cols: 4, rows: 1, w: 2600, h: 800 },
        '4_2x2-grid':     { cols: 2, rows: 2, w: 1400, h: 1400 },
    }
    const key = `${num}_${layout}` as keyof typeof layouts;
    const { cols, rows, w, h } = layouts[key] || layouts['2_side-by-side'];
    
    collageCanvas.width = w;
    collageCanvas.height = h;

    ctx.fillStyle = '#FAD2E1'; // baby pink background
    ctx.fillRect(0, 0, w, h);

    const loadedImages = await Promise.all(
      capturedPhotos.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }))
    );

    const padding = w * 0.03;
    const totalPaddingX = padding * (cols + 1);
    const totalPaddingY = padding * (rows + 1);
    const polaroidWidth = (w - totalPaddingX) / cols;
    const polaroidHeight = (h - totalPaddingY) / rows;
    
    for(let i=0; i<loadedImages.length; i++) {
        const img = loadedImages[i];
        const row = Math.floor(i / cols);
        const col = i % cols;

        const polaroidX = padding + col * (polaroidWidth + padding);
        const polaroidY = padding + row * (polaroidHeight + padding);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = 'white';
        ctx.fillRect(polaroidX, polaroidY, polaroidWidth, polaroidHeight);
        ctx.restore();

        const photoPadding = polaroidWidth * 0.05;
        const bottomMargin = polaroidHeight * 0.15;
        const photoX = polaroidX + photoPadding;
        const photoY = polaroidY + photoPadding;
        const photoW = polaroidWidth - (photoPadding * 2);
        const photoH = polaroidHeight - (photoPadding + bottomMargin);

        ctx.drawImage(img, photoX, photoY, photoW, photoH);
    }
    
    setFinalCollage(collageCanvas.toDataURL('image/jpeg', 0.9));
  }, [capturedPhotos, layout, numPhotos]);

  useEffect(() => {
    if (step === 'collage' && capturedPhotos.length === parseInt(numPhotos)) {
      generateCollage();
    }
  }, [step, capturedPhotos, numPhotos, generateCollage]);

  const handleDownload = () => {
    if (finalCollage) {
      const link = document.createElement('a');
      link.href = finalCollage;
      link.download = `photobooth-collage-${new Date().getTime()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleStartOver = () => {
    setCapturedPhotos([]);
    setFinalCollage(null);
    setNumPhotos('2');
    setLayout('side-by-side');
    setStep('welcome');
  };

  const renderWelcomeStep = () => (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 animate-in fade-in duration-1000">
      <div className="relative">
        <Sparkles className="absolute -top-8 -left-8 w-12 h-12 text-accent animate-pulse" />
        <Sparkles className="absolute -bottom-8 -right-8 w-12 h-12 text-accent animate-pulse delay-500" />
        <h1 className="text-5xl md:text-7xl font-bold text-foreground/80 tracking-tight">
          Pastel Photobooth
        </h1>
      </div>
      <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-md">
        Create cute, aesthetic polaroid collages in just a few clicks!
      </p>
      <Button size="lg" className="mt-8 text-lg" onClick={() => setStep('selection')}>
        Take Photo
        <Heart className="ml-2 fill-current" />
      </Button>
    </div>
  );

  const renderSelectionStep = () => (
    <Dialog open={step === 'selection'} onOpenChange={(open) => !open && setStep('welcome')}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="text-accent" />
            Create your Collage
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="font-semibold text-base">How many Polaroids?</Label>
            <RadioGroup value={numPhotos} onValueChange={setNumPhotos} className="flex gap-4">
              {['2', '3', '4'].map(val => (
                <div key={val} className="flex items-center space-x-2">
                  <RadioGroupItem value={val} id={`r-${val}`} />
                  <Label htmlFor={`r-${val}`} className="text-base">{val}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {numPhotos !== '3' && (
            <div className="space-y-3 animate-in fade-in">
              <Label className="font-semibold text-base">Choose a layout</Label>
              <RadioGroup value={layout} onValueChange={(v) => setLayout(v as Layout)} className="flex gap-4">
                {numPhotos === '2' && (
                  <>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="side-by-side" id="l-sbs" /><Label htmlFor="l-sbs">Side-by-side</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="up-and-down" id="l-uad" /><Label htmlFor="l-uad">Up-and-down</Label></div>
                  </>
                )}
                {numPhotos === '4' && (
                  <>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="side-by-side" id="l-sbs4" /><Label htmlFor="l-sbs4">Side-by-side</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="2x2-grid" id="l-2x2" /><Label htmlFor="l-2x2">2x2 Grid</Label></div>
                  </>
                )}
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" size="lg" onClick={() => setStep('capture')}>
            Start Camera <Camera className="ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderCaptureStep = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4 animate-in fade-in">
      <h2 className="text-2xl font-bold text-center">
        {`Capture ${numPhotos} photos! (${capturedPhotos.length}/${numPhotos})`}
      </h2>
      <Card className="w-full max-w-4xl aspect-video overflow-hidden shadow-xl">
        <CardContent className="p-0 relative h-full w-full">
          {!isWebcamReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <Loader2 className="w-12 h-12 animate-spin text-primary-foreground" />
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover transition-opacity duration-500", isWebcamReady ? "opacity-100" : "opacity-0")} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button size="lg" onClick={handleCapture} disabled={!isWebcamReady || capturedPhotos.length >= parseInt(numPhotos)}>
          <Camera className="mr-2" /> Capture
        </Button>
        <Button size="lg" variant="outline" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {Array.from({ length: parseInt(numPhotos) }).map((_, i) => (
          <Card key={i} className="w-24 h-24 bg-muted flex items-center justify-center shadow-inner">
            {capturedPhotos[i] ? (
              <Image src={capturedPhotos[i]} alt={`Capture ${i + 1}`} width={96} height={96} className="object-cover rounded-md" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCollageStep = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 gap-6 animate-in fade-in">
      <div className="text-center">
        <h2 className="text-4xl font-bold tracking-tight">Your Collage is Ready!</h2>
        <p className="text-muted-foreground mt-2">So cute! You can now download your creation.</p>
      </div>
      <Card className="max-w-4xl w-full shadow-xl">
        <CardContent className="p-4">
          {finalCollage ? (
            <Image src={finalCollage} alt="Generated collage" width={2600} height={1400} className="rounded-lg w-full h-auto" />
          ) : (
            <div className="aspect-video flex items-center justify-center bg-muted rounded-lg">
              <Loader2 className="w-12 h-12 animate-spin text-primary-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-4">
        <Button size="lg" onClick={handleDownload} disabled={!finalCollage}>
          <Download className="mr-2" /> Download JPG
        </Button>
        <Button size="lg" variant="outline" onClick={handleStartOver}>
          <RotateCcw className="mr-2" /> Make Another
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background font-body text-foreground">
      {step === 'welcome' && renderWelcomeStep()}
      {renderSelectionStep()}
      {step === 'capture' && renderCaptureStep()}
      {step === 'collage' && renderCollageStep()}
      <canvas ref={photoCanvasRef} className="hidden" />
      <canvas ref={collageCanvasRef} className="hidden" />
    </div>
  );
};

export default PhotoBooth;
