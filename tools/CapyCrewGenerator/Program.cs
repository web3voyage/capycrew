using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.Text;
using System.Text.Json;

internal static class Program
{
    const int Supply = 10_000;
    static readonly string[] Hats =
    [
        "Rainbow Beanie","Ribbed Beanie","Cuffed Beanie","Slouch Beanie","Pom Beanie",
        "Baseball Cap","Backwards Cap","Five Panel Cap","Trucker Cap","Bucket Hat",
        "Safari Bucket","Beret","Flat Cap","Fedora","Cowboy Hat","Trapper Hat",
        "Aviator Hat","Balaclava","Street Hood","Crew Crown","Hard Hat",
        "Racing Helmet","Chrome Visor","Bandana","Durag"
    ];
    static readonly Outfit[] Outfits =
    [
        new("Varsity Pop","#294A9B","#FF641E","#20C6A5","#FFD23F"), new("Rose Hoodie","#C96591","#F4A9C6","#733A59","#FFF4F8"),
        new("Frost Sherpa","#E8E4DA","#9EA7AE","#202429","#FFFFFF"), new("Noir Techwear","#14171C","#FF6B25","#3E4650","#F1F3F5"),
        new("Moss Utility","#496342","#A8C96D","#26362B","#F0D36B"), new("Ocean Puffer","#166C8B","#45D4E5","#123B58","#E6FAFF"),
        new("Indigo Denim","#2D4B79","#E29A56","#17283F","#F3E1C2"), new("Crimson Racer","#A62D35","#FF7A24","#282A35","#FFF1D0"),
        new("Lilac Track","#7657A8","#F34F9A","#29294E","#BFF4F1"), new("Cloud Windbreaker","#DDECF0","#8ED6E5","#6D8593","#FFFFFF"),
        new("Amber Courier","#B54C2E","#FFB144","#563226","#FFF0CC"), new("Civic Blazer","#252A35","#D8B66B","#15171C","#F4E8CF"),
        new("Mint Cardigan","#82B99A","#DDF1C6","#3D6551","#FFF9E9"), new("Desert Poncho","#A65B42","#EAB56B","#4D342E","#F8E3BC"),
        new("Signal Raincoat","#E3C52E","#24292F","#49A6A1","#FFFCE0"), new("Orbit Suit","#D7DEE7","#6BC8FF","#38465B","#FF9A4B"),
        new("Midnight Biker","#1F2229","#B7BCC4","#090A0D","#E83A43"), new("Urban Camo","#4D5C45","#88936A","#30382D","#C7B56A"),
        new("Mono Luxe","#E7E1D6","#1C1D20","#8B8277","#C8A86B"), new("Pastel Club","#79A9D8","#F49CC0","#80C9AF","#FFE382"),
        new("Neon Circuit","#2F2D74","#FF3FA4","#14D8D4","#C8FF3D"), new("Retro Court","#244C82","#E74B35","#F3B843","#F7F0DC"),
        new("Graffiti Crew","#32396B","#FF642A","#23C8AE","#F653A6"), new("Gold Standard","#293241","#D8AD55","#111821","#FFF1C2"),
        new("Festival Mix","#6047A6","#FF6D3A","#21C3A8","#FFE04B")
    ];
    static readonly Bg[] Backgrounds =
    [
        new("Mint Studio","#9BE4C6","#5CB997"),new("Rose Studio","#F2B8CA","#C97596"),new("Night Grid","#151820","#3B4354"),new("Ivory Paper","#EEE9DF","#BDB4A5"),
        new("Ocean Wall","#86CADA","#28768E"),new("Ember Room","#633126","#C85731"),new("Moss Wall","#607B60","#283C31"),new("Lilac Stage","#BCA5D8","#6D4F96"),
        new("Sunset Block","#F4A55A","#D84954"),new("Concrete","#B7BCC0","#626A70"),new("Lemon Pop","#F1DC5A","#E66B42"),new("Aqua Signal","#47C7C5","#15556A"),
        new("Cherry Noir","#7D2638","#1B1720"),new("Sky Club","#8DB7E8","#E7B7D0"),new("Arcade","#30266C","#E33C96"),new("Gallery White","#F5F4F0","#CFD3D4")
    ];
    static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    static int Main(string[] args)
    {
        var o = Options.Parse(args);
        Directory.CreateDirectory(o.Output);
        Directory.CreateDirectory(Path.Combine(o.Output,"metadata"));
        var tokens = BuildTokens();
        WriteManifest(tokens,o.Output);
        if (o.ManifestOnly) { Console.WriteLine($"Wrote {tokens.Count:N0} unique token records to {o.Output}"); return 0; }
        using var source = new Bitmap(o.Source);
        using var character = PrepareCharacter(source);
        using var face = PrepareFace(source);
        var selected = Select(tokens,o);
        var files = new List<string>();
        foreach (var t in selected)
        {
            var file = Render(character,face,t,o);
            files.Add(file); WriteMetadata(t,o.Output,Path.GetFileName(file));
            if (files.Count % 25 == 0 || files.Count == selected.Count) Console.WriteLine($"Rendered {files.Count}/{selected.Count}");
        }
        if (o.Sheet is not null && files.Count > 0) Sheet(files,o.Sheet);
        Console.WriteLine($"Collection combinations: {tokens.Count:N0} unique");
        Console.WriteLine($"Rendered images: {files.Count:N0}");
        return 0;
    }

    static List<Token> BuildTokens()
    {
        var r = new List<Token>(Supply); var keys = new HashSet<string>();
        for (int b=0;b<16;b++) for (int o=0;o<25;o++) for (int h=0;h<25;h++)
        { var key=$"{h}:{o}:{b}"; if(!keys.Add(key)) throw new Exception("Duplicate "+key); r.Add(new(r.Count+1,h,o,b)); }
        if(r.Count!=Supply) throw new Exception("Collection size mismatch"); return r;
    }
    static List<Token> Select(List<Token> all,Options o)
    {
        if(o.Proof>0)
        {
            var r=new List<Token>(); var seen=new HashSet<int>();
            for(int i=0;r.Count<o.Proof && i<Supply*2;i++)
            { int h=i%25, outfit=(i*7)%25, bg=(i*5+i/16)%16, id=1+h+25*outfit+625*bg; if(seen.Add(id)) r.Add(all[id-1]); }
            return r;
        }
        return all.Skip(Math.Clamp(o.Start,1,Supply)-1).Take(Math.Clamp(o.Count,0,Supply-o.Start+1)).ToList();
    }

    static Bitmap PrepareCharacter(Bitmap src)
    {
        var b=new Bitmap(src.Width,src.Height,PixelFormat.Format32bppArgb);
        using var g=Graphics.FromImage(b); g.CompositingMode=CompositingMode.SourceCopy; g.DrawImageUnscaled(src,0,0);
        using var p=new GraphicsPath(); p.AddPolygon([new(108,15),new(202,5),new(277,33),new(326,91),new(330,148),new(287,185),new(164,190),new(112,158),new(98,82)]);
        g.FillPath(Brushes.Transparent,p); return b;
    }
    static unsafe Bitmap PrepareFace(Bitmap src)
    {
        var b=new Bitmap(src.Width,src.Height,PixelFormat.Format32bppArgb); using(var g=Graphics.FromImage(b)){g.CompositingMode=CompositingMode.SourceCopy;g.DrawImageUnscaled(src,0,0);}
        var d=b.LockBits(new(0,0,b.Width,b.Height),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
        try { for(int y=0;y<b.Height;y++){var row=(byte*)d.Scan0+y*d.Stride; for(int x=0;x<b.Width;x++){var q=row+x*4; double dx=(x-255)/132d,dy=(y-205)/112d; bool head=dx*dx+dy*dy<=1 && (y<=250||x>=235); bool whiskers=x>=335&&x<=420&&y>=145&&y<=255; bool region=head||whiskers; if(!region||q[3]<16){q[3]=0;continue;} var c=Color.FromArgb(q[3],q[2],q[1],q[0]); var br=c.GetBrightness(); var sat=c.GetSaturation(); var hue=c.GetHue(); bool fur=hue<=52&&sat>=.12f&&br>=.12f&&br<=.84f; bool highlight=br>.70f&&sat<.30f&&y<255; if((whiskers&&!head&&br>.32f)||(!fur&&br>.32f&&!highlight))q[3]=0; } } } finally{b.UnlockBits(d);} return b;
    }

    static string Render(Bitmap character,Bitmap face,Token t,Options o)
    {
        var dir=Path.Combine(o.Output,"images");Directory.CreateDirectory(dir); using var b=new Bitmap(o.Size,o.Size,PixelFormat.Format24bppRgb); using var g=Graphics.FromImage(b);
        g.SmoothingMode=SmoothingMode.AntiAlias;g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.TextRenderingHint=System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        DrawBackground(g,o.Size,t.Bg); float s=Math.Min(o.Size*.69f/500f,o.Size*.94f/715f), w=500*s,h=715*s,ox=(o.Size-w)/2,oy=o.Size-h-o.Size*.018f; var dest=new RectangleF(ox,oy,w,h);
        g.DrawImage(character,dest); DrawOutfit(g,t,ox,oy,s); DrawHat(g,t,ox,oy,s); g.DrawImage(face,dest); DrawHatLabel(g,t,ox,oy,s); DrawNumbers(g,t,ox,oy,s);
        var ext=o.Format=="png"?"png":"jpg";var path=Path.Combine(dir,$"capycrew-{t.Id:0000}.{ext}"); if(ext=="png")b.Save(path,ImageFormat.Png);else SaveJpeg(b,path,o.Quality);return path;
    }
    static void DrawBackground(Graphics g,int size,int idx)
    {
        var bg=Backgrounds[idx];using var grad=new LinearGradientBrush(new(0,0,size,size),C(bg.A),C(bg.B),idx%2==0?35:135);g.FillRectangle(grad,0,0,size,size);
        using var pen=new Pen(Color.FromArgb(40,255,255,255),Math.Max(2,size/300f));using var dot=new SolidBrush(Color.FromArgb(25,10,18,24));float u=size/8f;
        if(idx%4==0)for(int i=-2;i<12;i++)g.DrawLine(pen,i*u,0,(i-4)*u,size); else if(idx%4==1){for(int y=0;y<size;y+=(int)u)g.DrawLine(pen,0,y,size,y);for(int x=0;x<size;x+=(int)u)g.DrawLine(pen,x,0,x,size);} else if(idx%4==2)for(int i=0;i<18;i++)g.FillEllipse(dot,(i*113)%size,(i*197)%size,u*.42f,u*.42f); else {g.FillRectangle(dot,0,size*.72f,size,size*.28f);g.DrawLine(pen,0,size*.72f,size,size*.72f);}
    }
    static void DrawOutfit(Graphics g,Token t,float ox,float oy,float s)
    {
        var o=Outfits[t.Outfit];using var fill=new SolidBrush(Color.FromArgb(145,C(o.Primary)));using var alt=new SolidBrush(Color.FromArgb(190,C(o.Secondary)));using var accent=new SolidBrush(Color.FromArgb(225,C(o.Accent)));using var pen=new Pen(Color.FromArgb(220,C(o.Accent)),Math.Max(2,5*s));using var ink=new Pen(Color.FromArgb(230,15,18,22),Math.Max(2,3*s));
        PointF P(float x,float y)=>new(ox+x*s,oy+y*s);RectangleF R(float x,float y,float w,float h)=>new(ox+x*s,oy+y*s,w*s,h*s);
        switch(t.Outfit%10){case 1:g.DrawArc(pen,R(137,208,230,96),190,160);break;case 2:for(int y=270;y<470;y+=30)g.DrawArc(pen,R(86,y,330,28),8,164);break;case 3:g.FillPolygon(fill,[P(112,268),P(214,245),P(234,480),P(128,464)]);g.FillPolygon(fill,[P(364,268),P(264,245),P(245,480),P(351,464)]);break;case 4:g.FillRectangle(fill,R(120,300,90,135));g.FillRectangle(fill,R(276,300,72,135));break;case 5:for(int y=280;y<460;y+=42)g.DrawLine(pen,P(92,y),P(382,y));break;case 6:g.DrawLine(pen,P(239,252),P(239,486));g.DrawArc(pen,R(108,260,262,220),20,140);break;case 7:for(int i=0;i<9;i++)g.FillEllipse(fill,R(92+(i*37)%270,274+(i*59)%170,36,22));break;case 8:g.DrawLine(pen,P(117,276),P(355,474));g.DrawLine(pen,P(356,276),P(118,474));break;case 9:for(int i=0;i<6;i++)g.DrawBezier(pen,P(86,294+i*28),P(176,250+i*41),P(278,356-i*13),P(382,286+i*33));break;default:g.DrawLine(pen,P(239,252),P(239,486));break;}
        using var f=new Font("Arial",Math.Max(7,10*s),FontStyle.Bold,GraphicsUnit.Pixel);using var txt=new SolidBrush(Color.FromArgb(235,15,17,20));var rr=R(283,506,78,27);g.FillRoundedRectangle(accent,rr,5*s);g.DrawString("CREW",f,txt,P(291,512));
    }
    static void DrawHat(Graphics g,Token t,float ox,float oy,float s)
    {
        var o=Outfits[t.Outfit];using var a=new SolidBrush(C(o.Primary));using var b=new SolidBrush(C(o.Secondary));using var c=new SolidBrush(C(o.Accent));using var line=new Pen(Color.FromArgb(245,13,15,19),Math.Max(2,5*s)){LineJoin=LineJoin.Round};using var stitch=new Pen(Color.FromArgb(165,255,255,255),Math.Max(1,2*s));
        PointF P(float x,float y)=>new(ox+x*s,oy+y*s);RectangleF R(float x,float y,float w,float h)=>new(ox+x*s,oy+y*s,w*s,h*s);void Poly(PointF[] pts,Brush br){g.FillPolygon(br,pts);g.DrawPolygon(line,pts);}int k=t.Hat;
        if(k<=4){PointF[] crown=[P(124,142),P(117,92),P(137,48),P(186,27),P(248,35),P(296,62),P(319,111),P(305,153),P(273,172),P(167,176)];Poly(crown,a);g.FillRectangle(b,R(126,138,181,35));g.DrawRectangle(line,R(126,138,181,35));if(k==0){Color[] cc=[C("#FF6B35"),C("#2D4D9A"),C("#23BCA5"),C("#F5C842"),C("#E74F93")];for(int i=0;i<5;i++){using var p=new Pen(cc[i],13*s);g.DrawLine(p,P(145+i*29,42),P(121+i*34,139));}}if(k==1||k==2)for(int x=138;x<300;x+=14)g.DrawLine(stitch,P(x,45),P(x-13,137));if(k==3)g.FillEllipse(a,R(113,20,118,85));if(k==4){g.FillEllipse(c,R(198,4,47,47));g.DrawEllipse(line,R(198,4,47,47));}}
        else if(k<=8){g.FillPie(a,R(134,67,176,114),180,180);g.DrawArc(line,R(134,67,176,114),180,180);var brim=k==6?R(112,132,145,30):R(232,130,115,31);g.FillEllipse(b,brim);g.DrawEllipse(line,brim);if(k==8){g.FillRectangle(c,R(245,74,57,54));g.DrawRectangle(line,R(245,74,57,54));}}
        else if(k<=10){Poly([P(147,63),P(284,63),P(311,132),P(129,132)],a);g.FillEllipse(b,R(95,118,250,48));g.DrawEllipse(line,R(95,118,250,48));}
        else if(k==11){g.FillEllipse(a,R(113,58,207,96));g.DrawEllipse(line,R(113,58,207,96));g.FillEllipse(b,R(124,117,181,35));}
        else if(k==12){g.FillPie(a,R(124,73,195,105),180,180);g.DrawArc(line,R(124,73,195,105),180,180);g.FillEllipse(b,R(108,130,223,32));g.DrawEllipse(line,R(108,130,223,32));}
        else if(k<=14){Poly([P(148,53),P(275,53),P(301,126),P(131,126)],a);var rr=R(k==14?73:101,112,k==14?300:243,51);g.FillEllipse(b,rr);g.DrawEllipse(line,rr);}
        else if(k<=16){g.FillPie(a,R(122,42,205,143),180,180);g.DrawArc(line,R(122,42,205,143),180,180);g.FillEllipse(b,R(108,115,62,101));g.DrawEllipse(line,R(108,115,62,101));g.FillEllipse(b,R(282,115,62,101));g.DrawEllipse(line,R(282,115,62,101));}
        else if(k==17){using var path=new GraphicsPath(FillMode.Alternate);path.AddEllipse(R(117,36,215,171));path.AddEllipse(R(156,99,135,104));g.FillPath(a,path);g.DrawEllipse(line,R(117,36,215,171));g.DrawEllipse(line,R(156,99,135,104));}
        else if(k==18){using var hood=new Pen(C(o.Primary),27*s);g.DrawArc(line,R(108,32,235,250),183,174);g.DrawArc(hood,R(112,42,225,235),183,174);}
        else if(k==19){Poly([P(149,125),P(168,57),P(200,100),P(222,28),P(247,99),P(288,56),P(307,132)],c);g.FillRectangle(b,R(144,126,168,31));g.DrawRectangle(line,R(144,126,168,31));}
        else if(k==20){g.FillPie(a,R(126,55,197,133),180,180);g.DrawArc(line,R(126,55,197,133),180,180);g.FillRectangle(b,R(111,123,226,43));g.DrawRectangle(line,R(111,123,226,43));}
        else if(k<=22){g.FillPie(a,R(113,35,226,176),180,180);g.DrawArc(line,R(113,35,226,176),180,180);g.FillRectangle(c,R(132,112,191,42));g.DrawRectangle(line,R(132,112,191,42));}
        else{Poly([P(116,99),P(155,61),P(298,73),P(331,111),P(300,153),P(149,159)],a);if(k==24)g.FillPolygon(b,[P(283,87),P(363,58),P(324,129)]);}
    }
    static void DrawHatLabel(Graphics g,Token t,float ox,float oy,float s)
    {
        var o=Outfits[t.Outfit];var r=new RectangleF(ox+203*s,oy+(t.Hat is 13 or 14?101:112)*s,92*s,25*s);using var bg=new SolidBrush(Color.FromArgb(238,24,29,38));using var p=new Pen(C(o.Accent),Math.Max(1.5f,3*s));using var f=new Font("Arial",Math.Max(7,10.5f*s),FontStyle.Bold,GraphicsUnit.Pixel);using var ink=new SolidBrush(Color.White);var fmt=new StringFormat{Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center};g.FillRoundedRectangle(bg,r,5*s);g.DrawRoundedRectangle(p,r,5*s);g.DrawString("CAPYCREW",f,ink,r,fmt);
    }
    static void DrawNumbers(Graphics g,Token t,float ox,float oy,float s)
    {
        var o=Outfits[t.Outfit];using var bg=new SolidBrush(Color.FromArgb(244,C(o.Accent)));using var edge=new Pen(Color.FromArgb(238,18,20,24),Math.Max(1.5f,3*s));using var ink=new SolidBrush(Color.FromArgb(245,17,19,24));using var f=new Font("Arial",Math.Max(8,13*s),FontStyle.Bold,GraphicsUnit.Pixel);using var small=new Font("Arial",Math.Max(5,7.5f*s),FontStyle.Bold,GraphicsUnit.Pixel);var fmt=new StringFormat{Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center};var r=new RectangleF(ox+178*s,oy+421*s,90*s,33*s);g.FillRoundedRectangle(bg,r,5*s);g.DrawRoundedRectangle(edge,r,5*s);g.DrawString($"#{t.Id:0000}",f,ink,r,fmt);var state=g.Save();g.TranslateTransform(ox+428*s,oy+301*s);g.RotateTransform(8);var card=new RectangleF(-34*s,-16*s,68*s,36*s);using var cb=new SolidBrush(Color.FromArgb(235,151,232,221));g.FillRoundedRectangle(cb,card,4*s);g.DrawRoundedRectangle(edge,card,4*s);g.DrawString("CAPY",small,ink,new RectangleF(-32*s,-14*s,64*s,14*s),fmt);g.DrawString($"#{t.Id:0000}",small,ink,new RectangleF(-32*s,-1*s,64*s,18*s),fmt);g.Restore(state);
    }
    static void SaveJpeg(Image image,string path,long quality){var codec=ImageCodecInfo.GetImageEncoders().First(x=>x.FormatID==ImageFormat.Jpeg.Guid);using var ep=new EncoderParameters(1);ep.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,quality);image.Save(path,codec,ep);}
    static void Sheet(List<string> files,string path){int n=Math.Min(files.Count,100),cols=(int)Math.Ceiling(Math.Sqrt(n)),rows=(int)Math.Ceiling(n/(double)cols),cell=220;using var b=new Bitmap(cols*cell,rows*cell);using var g=Graphics.FromImage(b);g.Clear(Color.FromArgb(18,20,24));g.InterpolationMode=InterpolationMode.HighQualityBicubic;for(int i=0;i<n;i++){using var im=Image.FromFile(files[i]);g.DrawImage(im,new Rectangle(i%cols*cell,i/cols*cell,cell,cell));}Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);SaveJpeg(b,path,90);Console.WriteLine("Contact sheet: "+path);}
    static void WriteManifest(List<Token> ts,string output){using(var w=new StreamWriter(Path.Combine(output,"capycrew-10000.csv"),false,new UTF8Encoding(false))){w.WriteLine("id,name,hat,outfit,background,trait_key");foreach(var t in ts)w.WriteLine($"{t.Id},\"CapyCrew #{t.Id:0000}\",\"{Hats[t.Hat]}\",\"{Outfits[t.Outfit].Name}\",\"{Backgrounds[t.Bg].Name}\",{t.Hat:D2}-{t.Outfit:D2}-{t.Bg:D2}");}var summary=new{name="CapyCrew",total_supply=ts.Count,uniqueness="25 headwear x 25 outfits x 16 backgrounds = 10,000 unique combinations",invariants=new[]{"original capybara face and pose","CAPYCREW headwear label","token number on outfit","token number on held card"},traits=new{hats=Hats,outfits=Outfits.Select(x=>x.Name),backgrounds=Backgrounds.Select(x=>x.Name)}};File.WriteAllText(Path.Combine(output,"collection.json"),JsonSerializer.Serialize(summary,JsonOptions));}
    static void WriteMetadata(Token t,string output,string image){var m=new{name=$"CapyCrew #{t.Id:0000}",description="A unique CapyCrew streetwear collectible preserving the original character identity.",image=$"../images/{image}",attributes=new object[]{new{trait_type="Headwear",value=Hats[t.Hat]},new{trait_type="Outfit",value=Outfits[t.Outfit].Name},new{trait_type="Background",value=Backgrounds[t.Bg].Name},new{trait_type="Crew Number",value=t.Id.ToString("0000",CultureInfo.InvariantCulture)}}};File.WriteAllText(Path.Combine(output,"metadata",$"{t.Id:0000}.json"),JsonSerializer.Serialize(m,JsonOptions));}
    static Color C(string v)=>ColorTranslator.FromHtml(v);
    sealed record Outfit(string Name,string Primary,string Secondary,string Tertiary,string Accent);sealed record Bg(string Name,string A,string B);sealed record Token(int Id,int Hat,int Outfit,int Bg);
    sealed class Options
    {
        public string Source=Path.GetFullPath("assets/CapyCrew_042_cutout.png"),Output=Path.GetFullPath("output/capycrew-10000"),Format="jpg";public int Start=1,Count=Supply,Proof=0,Size=640;public long Quality=90;public bool ManifestOnly;public string? Sheet;
        public static Options Parse(string[] a){var o=new Options();for(int i=0;i<a.Length;i++)switch(a[i]){case"--source":o.Source=Path.GetFullPath(a[++i]);break;case"--output":o.Output=Path.GetFullPath(a[++i]);break;case"--start":o.Start=int.Parse(a[++i]);break;case"--count":o.Count=int.Parse(a[++i]);break;case"--proof":o.Proof=int.Parse(a[++i]);break;case"--size":o.Size=int.Parse(a[++i]);break;case"--format":o.Format=a[++i].ToLowerInvariant();break;case"--quality":o.Quality=long.Parse(a[++i]);break;case"--manifest-only":o.ManifestOnly=true;break;case"--contact-sheet":o.Sheet=Path.GetFullPath(a[++i]);break;default:throw new ArgumentException("Unknown argument: "+a[i]);}if(o.Size<256||o.Size>2048)throw new ArgumentOutOfRangeException("size");if(o.Format is not("jpg"or"png"))throw new ArgumentException("format");o.Quality=Math.Clamp(o.Quality,50,100);return o;}
    }
}
internal static class GraphicsExt
{
    public static void FillRoundedRectangle(this Graphics g,Brush b,RectangleF r,float rad){using var p=Path(r,rad);g.FillPath(b,p);}public static void DrawRoundedRectangle(this Graphics g,Pen pen,RectangleF r,float rad){using var p=Path(r,rad);g.DrawPath(pen,p);}static GraphicsPath Path(RectangleF r,float rad){float d=rad*2;var p=new GraphicsPath();p.AddArc(r.Left,r.Top,d,d,180,90);p.AddArc(r.Right-d,r.Top,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.Left,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
}
