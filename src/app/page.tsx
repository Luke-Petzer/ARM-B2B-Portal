'use client'

import { Bebas_Neue } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDown, Linkedin, Instagram, Phone, Mail, MapPin } from 'lucide-react'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas',
})

const departments = [
  {
    number: '01',
    name: 'Custom Steel Fabrication',
    subtitle: 'Laser Cutting · CNC Bending · Custom Metalwork',
    description:
      'From concept to finished component — we cut, bend and fabricate structural steel to exact tolerances. Our CNC laser cutting and press braking capabilities handle complex geometries for bespoke industrial applications.',
    image: '/image-1.webp',
    imageAlt: 'Laser cutting steel in a manufacturing facility',
  },
  {
    number: '02',
    name: 'Perimeter Security',
    subtitle: 'Razor Wire · Wall Spikes · Palisade Systems',
    description:
      'Comprehensive boundary protection solutions including razor wire concertinas, galvanised wall spikes and palisade systems. Engineered for maximum deterrence and long-term outdoor durability.',
    image: '/image-2.webp',
    imageAlt: 'Industrial perimeter security fencing',
  },
  {
    number: '03',
    name: 'Gate & Access Hardware',
    subtitle: 'Hinges · Catches · Lock Boxes · Security Bolts',
    description:
      'A complete range of gate fittings — from heavy-duty hinges and gate catches to lock boxes, barrel bolts and drop bolts. Precision-machined hardware built for high-frequency use and reliable access control.',
    image: '/image-3.webp',
    imageAlt: 'Industrial gate hardware and fittings',
  },
  {
    number: '04',
    name: 'Sliding Gate Systems',
    subtitle: 'Wheels · Tracks · Guides · Automation Ready',
    description:
      'Full structural kits for heavy-duty sliding gates. Machined tracking profiles, high-load-bearing wheels, guide systems and rigid chassis frames — everything needed for smooth, reliable gate operation.',
    image: '/image-4.webp',
    imageAlt: 'Industrial sliding gate system components',
  },
  {
    number: '05',
    name: 'Roofing & Construction',
    subtitle: 'Flashings · Truss Hangers · Bracing · Nail Plates',
    description:
      'Essential structural hardware for commercial roofing and general construction. Galvanised flashings, truss hangers, bracing straps, hoop iron and nail plates — built to last in demanding site conditions.',
    image: '/image-5.webp',
    imageAlt: 'Roofing and construction steel hardware',
  },
  {
    number: '06',
    name: 'Carport & Outdoor Structures',
    subtitle: 'Round & Square Poles · Washing Line Poles',
    description:
      'Round and square carport poles in multiple diameters and thicknesses, plus washing line poles. Galvanised and treated for outdoor durability — supplied in bulk packs for trade and construction.',
    image: '/image-6.webp',
    imageAlt: 'Steel carport and outdoor structure poles',
  },
  {
    number: '07',
    name: 'Workshop & Welding Supplies',
    subtitle: 'Argo Welding Rods · Cutting Disks · Tools',
    description:
      'Professional-grade workshop essentials under the Argo range — welding rods in multiple weights, cutting disks in all standard sizes, and gate wheel kits. Reliable consumables for fabricators and contractors.',
    image: '/image-7.webp',
    imageAlt: 'Welding and workshop tools and supplies',
  },
]

export default function LandingPage() {
  return (
    <div className={`${bebasNeue.variable} min-h-screen bg-[#050d14] text-white overflow-x-hidden`}>

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#050d14]/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 md:px-16 lg:px-24 py-4 flex items-center justify-between">
          <Link href="/" className="flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm">
            <Image
              src="/logo-dark.png"
              alt="AR Steel Manufacturing"
              height={60}
              width={150}
              className="object-contain border border-[#1a3a6e] rounded"
              priority
            />
          </Link>

          <div className="flex items-center gap-5 md:gap-8">
            <a
              href="#services"
              className="text-sm text-white/60 hover:text-white transition-colors duration-200 font-inter hidden md:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm"
            >
              Services
            </a>
            <a
              href="#footer"
              className="text-sm text-white/60 hover:text-white transition-colors duration-200 font-inter hidden md:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm"
            >
              Contact Us
            </a>
            <Link
              href="/login"
              className="text-sm border border-white/30 hover:border-white text-white px-5 py-2 rounded-sm transition-all duration-200 font-bebas tracking-widest hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center bg-[#050d14] overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      >
        {/* Radial vignette to soften grid toward edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, #050d14 100%)',
          }}
        />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24 pt-40 pb-24">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-2 h-2 bg-white/50 rotate-45 flex-shrink-0" />
            <span className="text-white/40 font-inter text-xs tracking-[0.3em] uppercase">
              AR · Steel Manufacturing
            </span>
          </div>

          <h1 className="font-bebas text-5xl sm:text-7xl md:text-[100px] lg:text-[120px] leading-[0.92] text-white mb-8 max-w-4xl">
            Built From Steel.<br />
            Built to Last.
          </h1>

          <p className="font-inter text-lg text-white/45 max-w-xl leading-relaxed mb-12 border-l-2 border-white/15 pl-6">
            Precision-manufactured steel products and hardware solutions for the
            construction, security and fabrication industries.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="#services"
              className="bg-white text-[#050d14] px-8 py-3 font-inter font-semibold text-sm hover:bg-white/90 transition-colors duration-200 cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              Our Services
            </a>
            <Link
              href="/login"
              className="border border-white/25 text-white px-8 py-3 font-inter font-semibold text-sm hover:bg-white/10 hover:border-white/50 transition-all duration-200 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              Login
            </Link>
          </div>
        </div>

        <div className="absolute bottom-10 left-8 md:left-16 lg:left-24 z-10">
          <ArrowDown className="w-5 h-5 text-white/25 animate-bounce motion-reduce:animate-none" />
        </div>
      </section>

      {/* ── DEPARTMENTS ── */}
      <section id="services">
        {departments.map((dept, index) => {
          const isEven = index % 2 === 1
          return (
            <div
              key={dept.number}
              className={`py-24 md:py-32 ${isEven ? 'bg-[#0a1929]' : 'bg-[#050d14]'}`}
            >
              <div className="max-w-[1400px] mx-auto px-6 md:px-16 lg:px-24">
                <div
                  className={`flex flex-col ${
                    isEven ? 'lg:flex-row-reverse' : 'lg:flex-row'
                  } items-center gap-12 lg:gap-20`}
                >
                  {/* Text half */}
                  <motion.div
                    className="w-full lg:w-5/12 flex flex-col items-start relative overflow-hidden"
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                  >
                    <span
                      className="font-bebas text-[120px] md:text-[160px] leading-none text-white/[0.04] select-none absolute -top-6 -left-2 pointer-events-none"
                      aria-hidden="true"
                    >
                      {dept.number}
                    </span>

                    <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl text-white uppercase leading-tight mb-3 relative z-10">
                      {dept.name}
                    </h2>

                    <div className="h-px w-full bg-white/[0.12] mb-5" />

                    <p className="font-inter text-[11px] font-semibold tracking-[0.2em] uppercase text-white/70 mb-5 flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-white/40 rotate-45 flex-shrink-0 inline-block" />
                      {dept.subtitle}
                    </p>

                    <p className="font-inter text-base text-white/45 leading-relaxed">
                      {dept.description}
                    </p>
                  </motion.div>

                  {/* Image half */}
                  <motion.div
                    className="w-full lg:w-7/12 overflow-hidden"
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.55, ease: 'easeOut', delay: 0.12 }}
                  >
                    <div className="aspect-[4/3] overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dept.image}
                        alt={dept.imageAlt}
                        className="object-cover w-full h-full grayscale-[40%] brightness-75 contrast-125 transition-all duration-500"
                        loading="lazy"
                      />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── CTA BANNER ── */}
      <section className="relative py-32 bg-[#0a1929] overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 border border-white/[0.04] rotate-45 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-64 h-64 border border-white/[0.04] rotate-45 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-8 text-center">
          <div className="w-3 h-3 bg-white/15 rotate-45 mx-auto mb-8" />
          <h2 className="font-bebas text-5xl md:text-7xl text-white mb-5">
            Ready to Place an Order?
          </h2>
          <p className="font-inter text-white/45 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Log in to access pricing, place orders and manage your account.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center bg-white text-[#050d14] px-10 py-4 font-bebas text-xl tracking-widest hover:bg-white/90 transition-colors duration-200 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#050d14] focus-visible:outline-offset-2"
          >
            Login to Order
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="footer" className="bg-[#03080c] border-t border-white/[0.05] pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-16 lg:px-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">

            {/* Brand */}
            <div>
              <Image
                src="/logo-dark.png"
                alt="AR Steel Manufacturing"
                height={60}
                width={150}
                className="object-contain mb-5"
              />
              <p className="font-inter text-sm text-white/35 leading-relaxed max-w-xs">
                Precision-manufactured steel products and hardware for the
                construction, security and fabrication industries.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bebas text-white tracking-widest text-lg mb-6 border-l-2 border-white/15 pl-3">
                Quick Links
              </h4>
              <ul className="space-y-3 font-inter text-sm text-white/40">
                <li>
                  <a
                    href="#services"
                    className="hover:text-white transition-colors duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm"
                  >
                    Our Services
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm">
                    Login
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bebas text-white tracking-widest text-lg mb-6 border-l-2 border-white/15 pl-3">
                Contact
              </h4>
              <ul className="space-y-4 font-inter text-sm text-white/40">
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>021 271 0526</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>info@armanufacturing.co.za</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/25" />
                  <span>
                    15 Hadji Ebrahim Crescent, Unit 9,<br />
                    Belgravia Industrial Park, Athlone, 7764
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-inter text-xs text-white/25 tracking-widest uppercase">
              © 2026 AR Steel Manufacturing. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <span aria-label="LinkedIn" className="text-white/25">
                <Linkedin className="w-5 h-5" />
              </span>
              <span aria-label="Instagram" className="text-white/25">
                <Instagram className="w-5 h-5" />
              </span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
