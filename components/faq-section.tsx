import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqSection() {
  return (
    <section className="py-20 bg-black">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Learn more about how our wBTC depeg insurance platform works
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem
              value="item-1"
              className="bg-gray-800/50 rounded-lg px-6 border border-gray-700"
            >
              <AccordionTrigger className="text-left text-lg font-medium py-4">
                What is a depeg event?
              </AccordionTrigger>
              <AccordionContent className="text-gray-300 pb-4">
                A depeg event occurs when a pegged token (like LBTC) loses its
                peg to the underlying asset (wBTC). This means the value of LBTC
                falls below its expected 1:1 ratio with wBTC, potentially
                causing significant losses for holders of the pegged token.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-2"
              className="bg-gray-800/50 rounded-lg px-6 border border-gray-700"
            >
              <AccordionTrigger className="text-left text-lg font-medium py-4">
                How do I become an underwriter?
              </AccordionTrigger>
              <AccordionContent className="text-gray-300 pb-4">
                To become an underwriter, you need to supply both pegged tokens
                (LBTC) and underlying tokens (wBTC) to the vault. In return,
                you'll receive depeg tokens that you can sell to hedgers. After
                the maturity period, you can claim all remaining tokens in the
                vault, earning a profit from the premiums paid by hedgers.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-3"
              className="bg-gray-800/50 rounded-lg px-6 border border-gray-700"
            >
              <AccordionTrigger className="text-left text-lg font-medium py-4">
                How do I hedge my LBTC position?
              </AccordionTrigger>
              <AccordionContent className="text-gray-300 pb-4">
                To hedge your LBTC position, you purchase wBTC depeg tokens from
                underwriters. These tokens act as insurance against a potential
                depeg event. If a depeg occurs before maturity, you can redeem
                your depeg tokens for the underlying wBTC, protecting your
                position from losses.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-4"
              className="bg-gray-800/50 rounded-lg px-6 border border-gray-700"
            >
              <AccordionTrigger className="text-left text-lg font-medium py-4">
                What happens at maturity?
              </AccordionTrigger>
              <AccordionContent className="text-gray-300 pb-4">
                At maturity, if no depeg event has occurred, underwriters can
                claim all remaining tokens in the vault. This includes both the
                pegged tokens (LBTC) and underlying tokens (wBTC) that weren't
                claimed by hedgers. The profit for underwriters comes from the
                premiums paid by hedgers for the insurance.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="item-5"
              className="bg-gray-800/50 rounded-lg px-6 border border-gray-700"
            >
              <AccordionTrigger className="text-left text-lg font-medium py-4">
                How is a depeg event determined?
              </AccordionTrigger>
              <AccordionContent className="text-gray-300 pb-4">
                A depeg event is determined by monitoring the price ratio
                between LBTC and wBTC across major decentralized exchanges. If
                the price of LBTC falls below a predetermined threshold (e.g.,
                0.95 wBTC), it's considered a depeg event, allowing hedgers to
                redeem their depeg tokens for the underlying wBTC.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
